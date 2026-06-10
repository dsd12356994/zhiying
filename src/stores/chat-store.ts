import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatState {
  messages: ChatMessage[];
  addMessage: (role: "user" | "assistant", content: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好！我是智映 AI 助手 🎬\n开启 AI 模式后，可用自然语言剪辑：\n- 「裁剪到 5 秒」\n- 「删除最后 2 秒」\n- 「分割」\n- 「导出视频」\n- 「添加字幕 你好世界」",
    },
  ],

  addMessage: (role, content) => {
    const msg: ChatMessage = {
      id: `${role}-${Date.now()}`,
      role,
      content,
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  clearMessages: () => set({ messages: [] }),
}));
