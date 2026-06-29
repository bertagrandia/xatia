import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../environments/environment';

interface RoomResponse {
  room_id: string;
  code: string;
  role: string;
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './rooms.component.html',
})
export class RoomsComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly authService = inject(AuthService);

  usernameInput = '';
  joinCode = '';
  error = signal('');
  loading = signal(false);

  enterChat() {
    const name = this.usernameInput.trim();
    if (!name) return;
    this.loading.set(true);
    this.error.set('');

    this.authService.login(name).subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.error.set('Error al entrar. Inténtalo de nuevo.');
        this.loading.set(false);
      },
    });
  }

  createRoom() {
    const token = this.authService.getToken();
    if (!token) return;
    this.loading.set(true);
    this.error.set('');

    this.http
      .post<RoomResponse>(`${environment.apiUrl}/rooms/create?token=${token}`, {})
      .subscribe({
        next: (res) =>
          this.router.navigate(['/chat', res.room_id], {
            state: { code: res.code, role: res.role },
          }),
        error: (err) => {
          if (err.status === 401) { this.authService.logout(); return; }
          this.error.set(err.error?.detail || 'Error al crear la sala');
          this.loading.set(false);
        },
      });
  }

  joinRoom() {
    const token = this.authService.getToken();
    if (!token || this.joinCode.length < 5) return;
    this.loading.set(true);
    this.error.set('');

    this.http
      .post<RoomResponse>(`${environment.apiUrl}/rooms/join?token=${token}`, {
        code: this.joinCode.toUpperCase(),
      })
      .subscribe({
        next: (res) =>
          this.router.navigate(['/chat', res.room_id], {
            state: { code: res.code, role: res.role },
          }),
        error: (err) => {
          if (err.status === 401) { this.authService.logout(); return; }
          this.error.set(err.error?.detail || 'Código de sala inválido');
          this.loading.set(false);
        },
      });
  }

  logout() {
    this.authService.logout();
  }
}
