-- The pictures bus mode keeps of what it saw (2026-10-12): the frame of each bus and the crop of each
-- OCR read, uploaded by the app next to the `bus.evidence` telemetry row that names them.
--
-- TEMPORARY — development only, like the rest of the evidence path: it is removed before the final
-- version (docs/ROADMAP.md, "Antes de la versión final"). They are pictures of the street, people
-- included, so the bucket is private: only the service role (the `evidence` function) writes, and
-- they are read from the dashboard or with a signed URL, never by the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 2000000, array['image/jpeg'])
on conflict (id) do nothing;
-- No policies on storage.objects for this bucket on purpose: for anon/authenticated it does not exist.
