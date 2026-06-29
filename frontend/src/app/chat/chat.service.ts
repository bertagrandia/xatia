import { Injectable, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  type: 'user_message' | 'ai_message' | 'system';
  content: string;
  sender?: string;
  tokens?: number;
  isMine?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private ws: WebSocket | null = null;
  private currentRoomId = '';

  messages = signal<ChatMessage[]>([]);
  connected = signal(false);
  roomClosed = signal(false);

  constructor(private authService: AuthService) {}

  connect(roomId: string): void {
    const token = this.authService.getToken();
    if (!token) return;

    this.currentRoomId = roomId;
    this.roomClosed.set(false);

    // Cargar historial guardado
    this.messages.set(this.loadMessages(roomId));

    this.ws = new WebSocket(`${environment.wsUrl}/ws/${roomId}?token=${token}`);

    this.ws.onopen = () => this.connected.set(true);

    this.ws.onmessage = (event) => {
      const msg: ChatMessage = JSON.parse(event.data);
      const me = this.authService.currentUser()?.username;

      if (msg.type === 'user_message') {
        msg.isMine = msg.sender === me;
      }

      if (msg.type === 'system' && msg.content.includes('cerrado')) {
        this.roomClosed.set(true);
        this.clearMessages(roomId);
      }

      this.messages.update((prev) => {
        const updated = [...prev, msg];
        this.saveMessages(roomId, updated);
        return updated;
      });
    };

    this.ws.onclose = () => this.connected.set(false);
    this.ws.onerror = () => this.connected.set(false);
  }

  sendMessage(content: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'user_message', content }));
    }
  }

  closeRoom(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'close_room' }));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.messages.set([]);
    this.connected.set(false);
    this.roomClosed.set(false);
    this.currentRoomId = '';
  }

  // ── Persistencia en localStorage ─────────────────────────────────────────

  private saveMessages(roomId: string, messages: ChatMessage[]): void {
    localStorage.setItem(`chat_msgs_${roomId}`, JSON.stringify(messages));
  }

  private loadMessages(roomId: string): ChatMessage[] {
    const data = localStorage.getItem(`chat_msgs_${roomId}`);
    return data ? JSON.parse(data) : [];
  }

  clearMessages(roomId: string): void {
    localStorage.removeItem(`chat_msgs_${roomId}`);
    localStorage.removeItem(`chat_room_${roomId}`);
  }
}
