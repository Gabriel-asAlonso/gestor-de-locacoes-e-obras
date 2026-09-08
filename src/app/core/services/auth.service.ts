import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly authenticated = signal(false);

  login(): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        this.authenticated.set(true);
        resolve();
      }, 650);
    });
  }

  logout(): void {
    this.authenticated.set(false);
  }
}
