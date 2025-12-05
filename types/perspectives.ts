import type { UUID } from "node:crypto";

export type PerspectiveLyric = {
  id?: UUID;
  lyric: string;
  timestamp: number;
  style?: string;
  url?: string;
};

export type Perspective = {
  id: UUID;
  perspective: string;
  topic_id: UUID;
  objective_src?: string;
  description?: string;
  width?: number;
  height?: number;
  sample_id?: UUID;
  edit_id?: UUID;
  track_id?: UUID;
  track_src?: string;
  collection_id?: UUID;
  start?: number;
  end?: number;
  lyrics?: PerspectiveLyric[][];
};

export type WritePerspectiveProps = {
  id: UUID;
  name: string;
  locked: boolean;
  token?: string;
  forward?: boolean;
  link?: string;
  perspectives: Perspective[];
};
