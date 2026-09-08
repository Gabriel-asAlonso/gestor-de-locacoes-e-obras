import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-page">
      <section class="login-brand" aria-label="Apresentação">
        <header class="login-brand-header">
          <div class="login-brand-lockup"><span class="sidebar-logo">GLO</span><div><strong>Gestor Patrimonial</strong><span>Locações e obras</span></div></div>
          <span class="login-module-badge">Ambiente seguro</span>
        </header>
        <div class="login-copy">
          <p class="eyebrow">Controle integrado</p>
          <h1>Seu patrimônio, <span>sob uma nova perspectiva.</span></h1>
          <p>Administre carteiras, imóveis, contratos, cobranças e obras em um único ambiente.</p>
          <ul class="login-capabilities">
            <li><span>01</span><strong>Visão patrimonial</strong><small>Indicadores e ocupação em tempo real</small></li>
            <li><span>02</span><strong>Gestão financeira</strong><small>Cobranças, recebimentos e despesas</small></li>
            <li><span>03</span><strong>Obras conectadas</strong><small>Cronograma, equipe e fornecedores</small></li>
          </ul>
        </div>
        <footer class="login-brand-footer"><div class="login-footer"><span></span>Sistema operacional</div><div class="login-property-caption"><strong>Centro Empresarial Nexo</strong><span>Carteira Atlas</span></div></footer>
      </section>
      <section class="login-panel">
        <div class="login-panel-inner">
          <div class="login-panel-context"><span>GLO</span><p><strong>Gestor de Locações e Obras</strong><small>Acesso ao ambiente de gestão</small></p></div>
          <form class="login-form" [formGroup]="form" (ngSubmit)="submit()">
            <div class="login-heading"><p class="eyebrow">Bem-vindo</p><h2>Acesse sua conta</h2><p>Use suas credenciais para continuar.</p></div>
            <label>E-mail<input type="email" formControlName="email" autocomplete="username" placeholder="nome@empresa.com.br"></label>
            <label>Senha<input type="password" formControlName="password" autocomplete="current-password" placeholder="••••••••"></label>
            @if (submitted() && form.invalid) { <p class="inline-field-error">Informe um e-mail válido e uma senha.</p> }
            <button class="primary-button login-button" type="submit" [disabled]="loading()"><span>{{ loading() ? 'Entrando…' : 'Entrar no sistema' }}</span><span class="login-button-arrow">→</span></button>
            <div class="login-trust-note"><span>✓</span><p><strong>Acesso protegido</strong><small>Seus dados permanecem somente neste ambiente demonstrativo.</small></p></div>
          </form>
          <p class="login-panel-version">Gestor Patrimonial · versão Angular</p>
        </div>
      </section>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly form = new FormGroup({
    email: new FormControl('gestor@atlas.com.br', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('gestor123', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    await this.auth.login();
    const destination = this.route.snapshot.queryParamMap.get('returnUrl') || '/inicio';
    await this.router.navigateByUrl(destination);
  }
}
