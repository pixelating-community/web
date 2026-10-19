# Book structure

The book is composed of chapters. Each chapter is composed of perspectives.
The structure within a perspective will be defined later.

## Topics and chapters

Topics and chapters are distinct content types with independent routes:

- `/t/<topic>` opens a topic from `topics`.
- `/c/<chapter>` opens a chapter from `chapters`, extending its linked topic.

Each chapter has its own ID and a unique `topic_id` foreign key. Its name,
perspectives, and access permissions currently come from that topic. The separate
chapter table and route modules allow chapter behavior to diverge in the future.
The migration starts chapters empty and does not convert or remove existing topics.
A topic without a chapter row is available only under `/t`.

Both route families support `/w/n`, `/w/<perspective-id>`,
`/p/<perspective-id>`, `/r/<perspective-id>`, `/k/<perspective-id>`,
`/ke/<perspective-id>`, `/ul`, `/store`, `/support/claim`, and `/tools`.
Navigation within either content type retains its route family.

This change does not introduce book records or chapter ordering.
