import type { NextRequest } from "next/server";

const localToken = "local-review-calendar-v1";

export function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== localToken)
    return Response.json(
      {
        error: {
          code: "SIGNED_ACTION_INVALID",
          message: "Calendar link is invalid",
        },
      },
      { status: 401 },
    );

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DogOS//Local Development Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:dogos-session-20260717@local",
    "DTSTAMP:20260715T120000Z",
    "DTSTART:20260717T060000Z",
    "DTEND:20260717T060400Z",
    "SUMMARY:DogOS - Orientierung mit Milo",
    "DESCRIPTION:Development-only protocol. Stop on food refusal, avoidance, or pain signs.",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(calendar, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="dogos-milo-calendar.ics"',
      "cache-control": "private, no-store",
      "x-dogos-revocable-link": "local-development",
    },
  });
}
