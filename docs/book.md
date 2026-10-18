# Book structure

The book is composed of chapters. Each chapter is composed of perspectives.
The structure within a perspective will be defined later.

## Chapter URLs

- `/c/<chapter>` opens a chapter.
- `/c/<chapter>/w/n` adds a perspective.
- `/c/<chapter>/w/<perspective-id>` edits a perspective.
- `/c/<chapter>/p/<perspective-id>` reads a perspective.
- `/c/<chapter>/r/<perspective-id>` opens its studio.
- `/c/<chapter>/k/<perspective-id>` opens karaoke playback.
- `/c/<chapter>/ke/<perspective-id>` edits karaoke timing.
- `/c/<chapter>/ul` unlocks a chapter.

Chapter pages replace the former `/t` pages. Existing records and perspective
membership are preserved: internal `topic` identifiers, storage, and API names
remain in place. This change does not introduce book records, chapter ordering,
or a structure within perspectives.
