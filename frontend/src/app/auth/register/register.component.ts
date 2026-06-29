import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">📖</div>
        <h2>Crear Cuenta</h2>
        <p class="auth-subtitle">Chat IA · El Señor de los Anillos</p>

        <form (ngSubmit)="onRegister()">
          <div class="form-group">
            <label for="username">Usuario</label>
            <input
              id="username"
              type="text"
              [(ngModel)]="username"
              name="username"
              required
              placeholder="Elige un nombre de usuario"
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
              placeholder="Elige una contraseña"
              autocomplete="new-password"
            />
          </div>

          @if (error()) {
            <p class="msg error">{{ error() }}</p>
          }
          @if (success()) {
            <p class="msg success">{{ success() }}</p>
          }

          <button type="submit" class="btn-primary btn-block" [disabled]="loading()">
            {{ loading() ? 'Registrando...' : 'Crear cuenta' }}
          </button>
        </form>

        <p class="switch-auth">
          ¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a>
        </p>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  username = '';
  password = '';
  error = signal('');
  success = signal('');
  loading = signal(false);

  constructor(private authService: AuthService, private router: Router) {}

  onRegister() {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    this.authService.register(this.username, this.password).subscribe({
      next: () => {
        this.success.set('¡Cuenta creada! Redirigiendo al login...');
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al registrarse');
        this.loading.set(false);
      },
    });
  }
}
