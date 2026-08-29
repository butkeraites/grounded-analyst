export interface ColumnProfile {
  name: string;
  dtype: string;
  nullCount: number;
  uniqueCount: number;
  sample: Array<string | number | boolean | null>;
}

export interface Dataset {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
  profile: { rowCount: number; columns: ColumnProfile[] };
}

export type Artifact =
  | { kind: "chart"; mimeType: string; data: string }
  | { kind: "table"; columns: string[]; rows: Array<Array<string | number | boolean | null>> };

export interface AssistantResult {
  conversationId: string;
  interpretation: string;
  artifacts: Artifact[];
  code: string;
  stdout: string;
  repairAttempts: number;
}

export type Message =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      status?: string;
      streamed?: string;
      result?: AssistantResult;
      error?: string;
    };
