import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">📖</div>
        <h2>Iniciar Sesión</h2>
        <p class="auth-subtitle">Chat IA · El Señor de los Anillos</p>

        <form (ngSubmit)="onLogin()">
          <div class="form-group">
            <label for="username">Usuario</label>
            <input
              id="username"
              type="text"
              [(ngModel)]="username"
              name="username"
              required
              placeholder="Tu nombre de usuario"
              autocomplete="username"
            />
          </div>
          <div class="form-group">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              placeholder="Tu contraseña"
              autocomplete="current-password"
            />
          </div>

          @if (error()) {
            <p class="msg error">{{ error() }}</p>
          }

          <button type="submit" class="btn-primary btn-block" [disabled]="loading()">
            {{ loading() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <p class="switch-auth">
          ¿No tienes cuenta? <a routerLink="/register">Regístrate</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  username = '';
  password = '';
  error = signal('');
  loading = signal(false);

  constructor(private authService: AuthService, private router: Router) {}

  onLogin() {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/rooms']),
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al iniciar sesión');
        this.loading.set(false);
      },
    });
  }
}
