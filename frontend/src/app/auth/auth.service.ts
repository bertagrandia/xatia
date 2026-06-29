import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  username: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;

  currentUser = signal<User | null>(this.loadUser());

  constructor(private http: HttpClient) {}

  private loadUser(): User | null {
    const data = localStorage.getItem('chat_user');
    return data ? JSON.parse(data) : null;
  }

  login(username: string) {
    return this.http
      .post<{ access_token: string }>(`${this.apiUrl}/auth/login`, { username })
      .pipe(
        tap((res) => {
          const user: User = { username, token: res.access_token };
          localStorage.setItem('chat_user', JSON.stringify(user));
          this.currentUser.set(user);
        })
      );
  }

  logout() {
    localStorage.removeItem('chat_user');
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return this.currentUser()?.token ?? null;
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }
}
