import postgres, { type Sql } from "postgres";

export type SearchResultKind =
  | "chapter"
  | "live_session"
  | "memory"
  | "message"
  | "video_analysis"
  | "video_observation";

export interface SearchResultRecord {
  createdAt: string;
  excerpt: string;
  href: string;
  id: string;
  kind: SearchResultKind;
  rank: number;
  title: string;
  workspace: "coach" | "media" | "plan" | "progress" | "setup" | "train";
}

interface SearchRow {
  created_at: Date;
  excerpt: string;
  href: string;
  id: string;
  kind: SearchResultKind;
  rank: string | number;
  title: string;
  workspace: SearchResultRecord["workspace"];
}

function mapRow(row: SearchRow): SearchResultRecord {
  return {
    createdAt: row.created_at.toISOString(),
    excerpt: row.excerpt,
    href: row.href,
    id: row.id,
    kind: row.kind,
    rank: Number(row.rank),
    title: row.title,
    workspace: row.workspace,
  };
}

export interface SearchStore {
  search(input: {
    dogId?: string | null;
    householdId: string;
    limit?: number;
    query: string;
  }): Promise<SearchResultRecord[]>;
}

export class InMemorySearchStore implements SearchStore {
  readonly #records: SearchResultRecord[];

  constructor(records: SearchResultRecord[] = []) {
    this.#records = records;
  }

  search(input: Parameters<SearchStore["search"]>[0]) {
    const query = input.query.trim().toLocaleLowerCase();
    if (query.length === 0) return Promise.resolve([]);
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    return Promise.resolve(
      this.#records
        .filter((record) =>
          `${record.title} ${record.excerpt}`
            .toLocaleLowerCase()
            .includes(query),
        )
        .slice(0, limit)
        .map((record) => structuredClone(record)),
    );
  }
}

export class SearchRepository implements SearchStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async search(input: Parameters<SearchStore["search"]>[0]) {
    const query = input.query.trim();
    if (query.length === 0) return [];
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    const rows = await this.#sql<SearchRow[]>`
      with search_query as (
        select websearch_to_tsquery('simple', ${query}) as query
      ),
      results as (
        select
          ('chapter:' || chapter.id::text) as id,
          'chapter'::text as kind,
          chapter.title,
          left(chapter.summary, 320) as excerpt,
          chapter.workspace,
          greatest(ts_rank_cd(chapter.searchable_text, search_query.query), 0.05) as rank,
          chapter.updated_at as created_at,
          '#message-' || coalesce(chapter.latest_message_id, chapter.first_message_id)::text as href
        from private.coach_chapters chapter, search_query
        where chapter.household_id = ${input.householdId}::uuid
          and (${input.dogId ?? null}::uuid is null or chapter.dog_id = ${input.dogId ?? null}::uuid)
          and chapter.archived_at is null
          and chapter.searchable_text @@ search_query.query

        union all

        select
          ('message:' || message.id::text) as id,
          'message'::text as kind,
          case message.role
            when 'user' then 'Owner message'
            when 'assistant' then 'DogOS response'
            else 'System message'
          end as title,
          left(message.content, 320) as excerpt,
          message.workspace,
          greatest(ts_rank_cd(message.searchable_text, search_query.query), 0.03) as rank,
          message.created_at,
          '#message-' || message.id::text as href
        from private.coach_messages message
        join private.coach_conversations conversation
          on conversation.id = message.conversation_id,
          search_query
        where conversation.household_id = ${input.householdId}::uuid
          and (${input.dogId ?? null}::uuid is null or conversation.dog_id = ${input.dogId ?? null}::uuid)
          and message.searchable_text @@ search_query.query

        union all

        select
          ('video:' || analysis.id::text) as id,
          'video_analysis'::text as kind,
          analysis.original_filename as title,
          left(analysis.status::text || ' ' || analysis.findings::text, 320) as excerpt,
          'media'::text as workspace,
          greatest(
            ts_rank_cd(
              to_tsvector(
                'simple',
                analysis.original_filename || ' ' || analysis.findings::text
              ),
              search_query.query
            ),
            0.02
          ) as rank,
          analysis.created_at,
          '/app/coach?space=media#video' as href
        from api.video_analyses analysis, search_query
        where analysis.household_id = ${input.householdId}::uuid
          and (${input.dogId ?? null}::uuid is null or analysis.dog_id = ${input.dogId ?? null}::uuid)
          and to_tsvector(
            'simple',
            analysis.original_filename || ' ' || analysis.findings::text
          ) @@ search_query.query

        union all

        select
          ('video-observation:' || observation.id::text) as id,
          'video_observation'::text as kind,
          observation.observation_code::text as title,
          left(observation.evidence || ' ' || observation.recommendation, 320) as excerpt,
          'media'::text as workspace,
          greatest(
            ts_rank_cd(
              to_tsvector(
                'simple',
                observation.observation_code::text || ' ' || observation.evidence || ' ' || observation.recommendation
              ),
              search_query.query
            ),
            0.02
          ) as rank,
          observation.created_at,
          '/app/coach?space=media#video' as href
        from private.video_analysis_observations observation
        join api.video_analyses analysis
          on analysis.id = observation.analysis_id,
          search_query
        where observation.household_id = ${input.householdId}::uuid
          and (${input.dogId ?? null}::uuid is null or analysis.dog_id = ${input.dogId ?? null}::uuid)
          and to_tsvector(
            'simple',
            observation.observation_code::text || ' ' || observation.evidence || ' ' || observation.recommendation
          ) @@ search_query.query

        union all

        select
          ('live:' || session.id::text) as id,
          'live_session'::text as kind,
          'Live coaching session' as title,
          left(session.status::text || ' ' || coalesce(session.summary, ''), 320) as excerpt,
          'media'::text as workspace,
          greatest(
            ts_rank_cd(
              to_tsvector(
                'simple',
                session.room_name || ' ' || coalesce(session.summary, '')
              ),
              search_query.query
            ),
            0.02
          ) as rank,
          session.created_at,
          '/app/coach?space=media#live' as href
        from api.live_coaching_sessions session, search_query
        where session.household_id = ${input.householdId}::uuid
          and (${input.dogId ?? null}::uuid is null or session.dog_id = ${input.dogId ?? null}::uuid)
          and to_tsvector(
            'simple',
            session.room_name || ' ' || coalesce(session.summary, '')
          ) @@ search_query.query

        union all

        select
          ('memory:' || memory.id::text) as id,
          'memory'::text as kind,
          memory.subject as title,
          left(memory.value, 320) as excerpt,
          'coach'::text as workspace,
          greatest(
            ts_rank_cd(to_tsvector('simple', memory.subject || ' ' || memory.value), search_query.query),
            0.02
          ) as rank,
          memory.updated_at as created_at,
          '/app/coach?action=profile#memory' as href
        from private.memory_facts memory, search_query
        where memory.household_id = ${input.householdId}::uuid
          and (${input.dogId ?? null}::uuid is null or memory.dog_id is null or memory.dog_id = ${input.dogId ?? null}::uuid)
          and memory.status in ('confirmed', 'candidate')
          and (memory.expires_at is null or memory.expires_at > now())
          and to_tsvector('simple', memory.subject || ' ' || memory.value) @@ search_query.query
      )
      select *
      from results
      order by rank desc, created_at desc
      limit ${limit}
    `;
    return rows.map(mapRow);
  }
}
