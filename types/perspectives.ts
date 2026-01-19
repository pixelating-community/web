import type { UUID } from "node:crypto";
import type { Cue } from "@/types/symbol";

export type Perspective = {
  id: UUID;
  perspective: string;
  topic_id: UUID;
  objective_src?: string;
  description?: string;
  width?: number;
  height?: number;
  collection_id?: UUID;
  audio_src?: string;
  start_time?: number;
  end_time?: number;
  symbols?: Cue[];
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
