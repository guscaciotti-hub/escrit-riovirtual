import { create } from 'zustand';
import type {
  Agent,
  Meeting,
  MeetingMessage,
  MeetingMinutes,
  SeatAssignment,
  TokenEstimate,
} from '@evoluze/shared';
import type { Bootstrap } from '../lib/api';

export type MeetingPhase = 'idle' | 'convening' | 'seating' | 'running' | 'finished';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface StoreState {
  // Bootstrap
  boot: Bootstrap | null;
  setBoot: (b: Bootstrap) => void;
  addAgent: (a: Agent) => void;
  agentById: (id: string) => Agent | undefined;

  // Conexão
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Proximidade
  nearbyAgentId: string | null;
  setNearbyAgent: (id: string | null) => void;

  // Chat 1:1
  chatAgentId: string | null;
  chatMessages: ChatMsg[];
  chatSending: boolean;
  chatTokens: { in: number; out: number; costUsd: number };
  openChat: (agentId: string) => void;
  closeChat: () => void;
  pushChat: (m: ChatMsg) => void;
  setChatSending: (v: boolean) => void;
  addChatTokens: (i: number, o: number, cost: number) => void;

  // Reunião
  meetingPhase: MeetingPhase;
  meeting: Meeting | null;
  seats: SeatAssignment[];
  meetingMessages: MeetingMessage[];
  thinkingAgentId: string | null;
  round: number;
  totalRounds: number;
  usage: { tokens: number; costUsd: number };
  minutes: MeetingMinutes | null;
  estimate: TokenEstimate | null;
  meetingError: string | null;

  setEstimate: (e: TokenEstimate | null) => void;
  onConvened: (meeting: Meeting, seats: SeatAssignment[]) => void;
  setMeetingPhase: (p: MeetingPhase) => void;
  onMeetingStarted: () => void;
  pushMeetingMessage: (m: MeetingMessage) => void;
  setThinking: (agentId: string | null) => void;
  setRound: (round: number, total: number) => void;
  setUsage: (tokens: number, costUsd: number) => void;
  setMinutes: (m: MeetingMinutes) => void;
  setMeetingError: (e: string | null) => void;
  resetMeeting: () => void;

  // UI modais
  meetingModalOpen: boolean;
  setMeetingModalOpen: (v: boolean) => void;
  agentFormOpen: boolean;
  setAgentFormOpen: (v: boolean) => void;
  minutesOpen: boolean;
  setMinutesOpen: (v: boolean) => void;
  transcriptOpen: boolean;
  setTranscriptOpen: (v: boolean) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  boot: null,
  setBoot: (b) => set({ boot: b }),
  addAgent: (a) =>
    set((s) => (s.boot ? { boot: { ...s.boot, agents: [...s.boot.agents, a] } } : {})),
  agentById: (id) => get().boot?.agents.find((a) => a.id === id),

  connected: false,
  setConnected: (v) => set({ connected: v }),

  nearbyAgentId: null,
  setNearbyAgent: (id) => set({ nearbyAgentId: id }),

  chatAgentId: null,
  chatMessages: [],
  chatSending: false,
  chatTokens: { in: 0, out: 0, costUsd: 0 },
  openChat: (agentId) => set({ chatAgentId: agentId, chatMessages: [], chatTokens: { in: 0, out: 0, costUsd: 0 } }),
  closeChat: () => set({ chatAgentId: null }),
  pushChat: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),
  setChatSending: (v) => set({ chatSending: v }),
  addChatTokens: (i, o, cost) =>
    set((s) => ({
      chatTokens: { in: s.chatTokens.in + i, out: s.chatTokens.out + o, costUsd: s.chatTokens.costUsd + cost },
    })),

  meetingPhase: 'idle',
  meeting: null,
  seats: [],
  meetingMessages: [],
  thinkingAgentId: null,
  round: 0,
  totalRounds: 0,
  usage: { tokens: 0, costUsd: 0 },
  minutes: null,
  estimate: null,
  meetingError: null,

  setEstimate: (e) => set({ estimate: e }),
  onConvened: (meeting, seats) =>
    set({
      meeting,
      seats,
      meetingPhase: 'seating',
      meetingMessages: [],
      minutes: null,
      thinkingAgentId: null,
      round: 0,
      totalRounds: meeting.maxRounds,
      usage: { tokens: 0, costUsd: 0 },
      meetingError: null,
      transcriptOpen: true,
    }),
  setMeetingPhase: (p) => set({ meetingPhase: p }),
  onMeetingStarted: () => set({ meetingPhase: 'running' }),
  pushMeetingMessage: (m) => set((s) => ({ meetingMessages: [...s.meetingMessages, m], thinkingAgentId: null })),
  setThinking: (agentId) => set({ thinkingAgentId: agentId }),
  setRound: (round, total) => set({ round, totalRounds: total }),
  setUsage: (tokens, costUsd) => set({ usage: { tokens, costUsd } }),
  setMinutes: (m) => set({ minutes: m, minutesOpen: true }),
  setMeetingError: (e) => set({ meetingError: e }),
  resetMeeting: () =>
    set({
      meetingPhase: 'idle',
      meeting: null,
      seats: [],
      meetingMessages: [],
      thinkingAgentId: null,
      round: 0,
      totalRounds: 0,
      usage: { tokens: 0, costUsd: 0 },
      minutes: null,
      meetingError: null,
    }),

  meetingModalOpen: false,
  setMeetingModalOpen: (v) => set({ meetingModalOpen: v }),
  agentFormOpen: false,
  setAgentFormOpen: (v) => set({ agentFormOpen: v }),
  minutesOpen: false,
  setMinutesOpen: (v) => set({ minutesOpen: v }),
  transcriptOpen: false,
  setTranscriptOpen: (v) => set({ transcriptOpen: v }),
}));
