import {
  NurseDashboardResponse,
  NurseFinalSummary,
  NurseLiveState,
  NurseQuestionEvent,
  NurseStreamEnvelope,
  NurseTierSummary,
} from '../types/nurse';

async function parseJsonResponse<T>(res: Response, requestLabel: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(`${requestLabel} failed (${res.status}): ${bodyText.slice(0, 180)}`);
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    const looksLikeHtml = bodyText.trimStart().toLowerCase().startsWith('<!doctype') || bodyText.trimStart().startsWith('<');
    if (looksLikeHtml) {
      throw new Error(
        `${requestLabel} returned HTML instead of JSON. This usually means the frontend dev server handled the route (missing /triage proxy) instead of the backend endpoint.`,
      );
    }

    throw new Error(
      `${requestLabel} returned invalid JSON (content-type: ${contentType || 'unknown'}). Response starts with: ${bodyText.slice(0, 120)}`,
    );
  }
}

export async function loadNurseDashboard(encounterId: string): Promise<NurseDashboardResponse> {
  const res = await fetch(`/triage/nurse/dashboard/${encounterId}`);
  return parseJsonResponse<NurseDashboardResponse>(res, 'Nurse dashboard request');
}

type NurseStreamHandlers = {
  onLiveState?: (liveState: NurseLiveState) => void;
  onQuestionGenerated?: (row: NurseQuestionEvent) => void;
  onQuestionValidated?: (row: NurseQuestionEvent) => void;
  onTierSummary?: (row: NurseTierSummary) => void;
  onFinalSummary?: (row: NurseFinalSummary) => void;
  onHeartbeat?: () => void;
  onConnected?: () => void;
  onAnyEvent?: (event: NurseStreamEnvelope) => void;
  onParseError?: (error: Error) => void;
};

export function subscribeNurseStream(encounterId: string, handlers: NurseStreamHandlers) {
  const es = new EventSource(`/triage/nurse/stream/${encounterId}`);

  const parse = (e: MessageEvent): NurseStreamEnvelope | null => {
    try {
      const data = JSON.parse(e.data) as NurseStreamEnvelope;
      handlers.onAnyEvent?.(data);
      return data;
    } catch (error) {
      handlers.onParseError?.(error instanceof Error ? error : new Error('Failed to parse SSE event'));
      return null;
    }
  };

  es.addEventListener('connected', (e) => {
    parse(e as MessageEvent);
    handlers.onConnected?.();
  });

  es.addEventListener('heartbeat', () => {
    handlers.onHeartbeat?.();
  });

  es.addEventListener('live_state.updated', (e) => {
    const data = parse(e as MessageEvent);
    const liveState = data?.payload?.live_state as NurseLiveState | undefined;
    if (liveState) handlers.onLiveState?.(liveState);
  });

  es.addEventListener('question.generated', (e) => {
    const data = parse(e as MessageEvent);
    const row = data?.payload?.question_event as NurseQuestionEvent | undefined;
    if (row) handlers.onQuestionGenerated?.(row);
  });

  es.addEventListener('question.validated', (e) => {
    const data = parse(e as MessageEvent);
    const row = data?.payload?.question_event as NurseQuestionEvent | undefined;
    if (row) handlers.onQuestionValidated?.(row);
  });

  es.addEventListener('tier.summary', (e) => {
    const data = parse(e as MessageEvent);
    const row = data?.payload?.tier_summary as NurseTierSummary | undefined;
    if (row) handlers.onTierSummary?.(row);
  });

  es.addEventListener('final.summary', (e) => {
    const data = parse(e as MessageEvent);
    const row = data?.payload?.final_summary as NurseFinalSummary | undefined;
    if (row) handlers.onFinalSummary?.(row);
  });

  return () => es.close();
}

export function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];
  const copy = [...items];
  copy[index] = next;
  return copy;
}
