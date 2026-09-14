# Homework links, photos and videos

In **Учебный процесс → Домашнее задание группе**, use **Добавить ссылку** or
**Фото или видео** before publishing. The same controls are available when
editing an assignment in a child's academic history. Parents open materials
inside the assignment in **Домашние задания**.

- Up to 10 materials per assignment: HTTP/HTTPS links, JPG/PNG/WebP/GIF images
  (10 MiB each), MP4/MOV/WebM videos (50 MiB each). Larger videos can be linked.
- Upload progress is shown. Publication and material changes are blocked while
  uploading. A failed upload retains earlier successful attachments.
- Files are private. Storage SELECT follows the recipient homework RLS, with
  staff access to their own drafts. Signed URLs last one hour and are obtained
  on demand. Videos are not downloaded or autoplayed when listing assignments.
- A supported container does not guarantee that every phone can play its codec;
  the viewer provides an original-file link as a fallback.
- New publications use an idempotent request UUID and a transaction: the final
  material list and all recipient rows are saved together. Repeating the same
  request returns its original count without another notification. The UUID is
  retained for retries while the form remains open; reopening a form starts a
  new publication. Legacy text-only assignments remain readable and editable.
- Recipient selection retains branch, group, time, weekday and archived-child
  rules. Editing a new assignment targets its publication UUID and existing RLS.
- The private publication ledger intentionally has RLS and no direct client
  grants or policies. Only the checked RPC reads/writes it. The public wrapper
  is SECURITY INVOKER. File metadata and uploader ownership are checked again
  by the database before materials are attached.
- Removing a newly uploaded, unattached file attempts draft cleanup. Attached
  files are protected from this cleanup. Abandoned uploads and detached files
  can remain in storage; there is no scheduled garbage collection in this change.

## Deployment and verification

Apply `20260914000240_homework_materials_private_uploads.sql` before the client
release. It is additive and preserves the old publication RPC for older clients.

- `node tests/homework-materials.mjs`
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`
- Run `supabase/tests/homework_materials.sql` as postgres. It uses existing role
  fixtures without embedding personal data, and rolls back all homework,
  notification, delivery and storage metadata changes.
- SQL checks cover atomic publication, duplicate retries and notifications,
  invalid material metadata, teacher authorization, parent isolation, manager
  editing, bucket privacy and ledger grants.

Release only after the exact commit's Vercel preview is READY; confirm the
production merge commit and production alias after merging.
