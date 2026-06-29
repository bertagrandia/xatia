import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  ViewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService, ChatMessage } from './chat.service';
import { AuthService } from '../auth/auth.service';

interface RoomState {
  code: string;
  role: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat.component.html',
})
export class ChatComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly chatService = inject(ChatService);
  readonly authService = inject(AuthService);

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  roomId = '';
  roomCode = signal('');
  role = signal('GUEST');
  messageInput = '';
  codeCopied = signal(false);

  constructor() {
    effect(() => {
      const msgs = this.chatService.messages();
      if (msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 30);
      }
    });

    effect(() => {
      if (this.chatService.roomClosed()) {
        setTimeout(() => this.router.navigate(['/rooms']), 2500);
      }
    });
  }

  ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('roomId') ?? '';
    if (!this.roomId) {
      this.router.navigate(['/rooms']);
      return;
    }

    // Intentar obtener estado de history.state (navegación normal)
    // o de localStorage (recarga de página)
    const state = history.state as Partial<RoomState>;
    const saved = this.loadRoomState(this.roomId);

    const code = state?.code || saved?.code;
    const role = state?.role || saved?.role;

    if (!code) {
      this.router.navigate(['/rooms']);
      return;
    }

    this.roomCode.set(code);
    this.role.set(role ?? 'GUEST');

    // Guardar para futuras recargas
    this.saveRoomState(this.roomId, { code, role: role ?? 'GUEST' });

    this.chatService.connect(this.roomId);
  }

  ngOnDestroy() {
    // No desconectamos aquí para que los mensajes persistan al recargar
    this.chatService['ws']?.close();
    this.chatService.connected.set(false);
  }

  sendMessage() {
    const content = this.messageInput.trim();
    if (!content || !this.chatService.connected()) return;
    this.chatService.sendMessage(content);
    this.messageInput = '';
  }

  closeRoom() {
    this.chatService.closeRoom();
    this.chatService.clearMessages(this.roomId);
    this.clearRoomState(this.roomId);
    this.chatService.disconnect();
    this.router.navigate(['/rooms']);
  }

  leaveRoom() {
    this.chatService.disconnect();
    this.clearRoomState(this.roomId);
    this.router.navigate(['/rooms']);
  }

  copyCode() {
    navigator.clipboard.writeText(this.roomCode()).then(() => {
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 2000);
    });
  }

  getSenderLabel(msg: ChatMessage): string {
    if (msg.type === 'ai_message') return 'IA 🤖';
    return msg.isMine ? 'Tú' : (msg.sender ?? 'Compañero');
  }

  private scrollToBottom() {
    this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Persistencia del estado de sala ──────────────────────────────────────

  private saveRoomState(roomId: string, state: RoomState): void {
    localStorage.setItem(`chat_room_${roomId}`, JSON.stringify(state));
  }

  private loadRoomState(roomId: string): RoomState | null {
    const data = localStorage.getItem(`chat_room_${roomId}`);
    return data ? JSON.parse(data) : null;
  }

  private clearRoomState(roomId: string): void {
    localStorage.removeItem(`chat_room_${roomId}`);
  }
}
