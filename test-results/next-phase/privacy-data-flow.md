# WhatsApp pilot privacy data flow

```text
allowlisted phone -> Meta WhatsApp Cloud -> signed HTTPS webhook -> DogOS private PostgreSQL schema
Supabase-authenticated browser -> one-time token hash -> explicit contact/user/household link
DogOS canonical result -> Meta Cloud API -> allowlisted phone
```

- Meta is a development-pilot communications provider/subprocessor and receives message bodies plus provider identifiers.
- Raw webhook payloads are verified in memory and not retained.
- Necessary message bodies are stored in the private schema for at most seven days; retention timestamps are indexed for deletion jobs.
- Contact identifiers remain private until unlink/deletion. Access tokens, app secrets, verify tokens, and signed-link plaintext are never stored in message records.
- Application logs contain normalized codes, trace IDs, and delivery metadata, not anamnesis message bodies or secrets.
- Unlink revokes the association and outstanding link records. Delete removes the provider contact and cascades pilot messages, events, sessions, failures, and links.
- No existing household, dog, plan, or progress data is exposed before explicit linking.
- Public release requires an approved privacy notice, DPA/subprocessor record, retention job, data-subject workflow, and legal review.
