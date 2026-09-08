import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { AppStore } from '../core/services/app-store.service';
import { EntityModalComponent } from '../shared/components/entity-modal.component';
import { ToastComponent } from '../shared/components/toast.component';

type NavigationItem = { label: string; route: string; glyph: string; count?: () => number };

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, EntityModalComponent, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell" [class.app-shell-sidebar-collapsed]="collapsed()" [class.sidebar-mobile-open]="mobileOpen()">
      <aside class="sidebar" [class.sidebar-collapsed]="collapsed()" aria-label="Navegação principal">
        <div class="sidebar-main">
          <header class="sidebar-brand">
            <span class="sidebar-logo">GLO</span>
            <div class="sidebar-brand-copy"><strong>Gestor Patrimonial</strong><span>Locações e obras</span></div>
            <button class="sidebar-collapse-button" type="button" (click)="collapsed.update(v => !v)" [attr.aria-label]="collapsed() ? 'Expandir menu' : 'Recolher menu'">{{ collapsed() ? '›' : '‹' }}</button>
            <button class="sidebar-mobile-close" type="button" (click)="mobileOpen.set(false)" aria-label="Fechar menu">×</button>
          </header>
          <p class="sidebar-nav-label">Módulos</p>
          <div class="module-switcher" role="tablist" aria-label="Módulo ativo">
            <button type="button" [class.active]="module() === 'm1'" (click)="switchModule('m1')">Locações</button>
            <button type="button" [class.active]="module() === 'm2'" (click)="switchModule('m2')">Obras</button>
          </div>
          @if (module() === 'm1') {
            <nav class="theme-list">
              @for (item of rentalNavigation; track item.route) {
                <a class="nav-item" [routerLink]="item.route" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="mobileOpen.set(false)">
                  <i class="sidebar-glyph {{ item.glyph }}"><span></span></i><span class="nav-item-label">{{ item.label }}</span>
                  @if (item.count) { <b>{{ item.count() }}</b> }
                </a>
              }
            </nav>
          } @else {
            <nav class="works-sidebar-menu">
              @for (item of worksNavigation; track item.route) {
                <a class="nav-item" [routerLink]="item.route" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="mobileOpen.set(false)">
                  <i class="sidebar-glyph {{ item.glyph }}"><span></span></i><span><strong>{{ item.label }}</strong></span>
                  @if (item.count) { <b>{{ item.count() }}</b> }
                </a>
              }
            </nav>
          }
        </div>
        <footer class="sidebar-footer">
          <div class="sidebar-environment"><span class="context-dot"></span><div><strong>Ambiente operacional</strong><small>{{ online() ? 'Sincronizado' : 'Sem conexão' }}</small></div></div>
          <div class="sidebar-account"><span class="account-avatar">AL</span><div class="account-copy"><strong>Augusto Lima</strong><small>Administrador</small></div><button class="logout-button" type="button" (click)="logout()" aria-label="Sair">↪</button></div>
        </footer>
      </aside>
      @if (mobileOpen()) { <button class="app-mobile-backdrop" type="button" aria-label="Fechar menu" (click)="mobileOpen.set(false)"></button> }
      <section class="workspace">
        <header class="topbar">
          <button class="menu-button app-mobile-menu" type="button" aria-label="Abrir menu" (click)="mobileOpen.set(true)">☰</button>
          <span class="breadcrumb">{{ module() === 'm1' ? 'Gestão patrimonial' : 'Gestão de obras' }} / {{ pageTitle() }}</span>
          <span class="topbar-context"><i class="context-dot"></i>{{ online() ? 'Dados atualizados' : 'Modo offline' }}</span>
        </header>
        <main class="content">
          @if (!online()) { <div class="connection-banner" role="alert"><span>!</span><div><strong>Sem conexão com a internet</strong><p>Você pode consultar os dados atuais; novas alterações permanecem nesta sessão.</p></div></div> }
          <router-outlet />
        </main>
      </section>
      <app-entity-modal />
      <app-toast />
    </div>
  `,
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly store = inject(AppStore);
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly online = signal(navigator.onLine);
  readonly url = signal(this.router.url);
  readonly module = computed(() => this.url().startsWith('/obras') ? 'm2' : 'm1');
  readonly pageTitle = signal('Visão geral');

  readonly rentalNavigation: NavigationItem[] = [
    { label: 'Visão geral', route: '/inicio', glyph: 'glyph-dashboard' },
    { label: 'Carteiras', route: '/carteiras', glyph: 'glyph-wallet', count: () => this.store.portfolios().length },
    { label: 'Imóveis', route: '/imoveis', glyph: 'glyph-building', count: () => this.store.properties().length },
    { label: 'Unidades', route: '/unidades', glyph: 'glyph-door', count: () => this.store.units().length },
    { label: 'Locatários', route: '/locatarios', glyph: 'glyph-users', count: () => this.store.tenants().length },
    { label: 'Contratos', route: '/contratos', glyph: 'glyph-contract', count: () => this.store.contracts().length },
    { label: 'Cobranças', route: '/cobrancas', glyph: 'glyph-income', count: () => this.store.charges().length },
    { label: 'Despesas', route: '/despesas', glyph: 'glyph-payable', count: () => this.store.expenses().length },
  ];
  readonly worksNavigation: NavigationItem[] = [
    { label: 'Painel de obras', route: '/obras/inicio', glyph: 'glyph-dashboard' },
    { label: 'Todas as obras', route: '/obras', glyph: 'glyph-briefcase', count: () => this.store.works().length },
    { label: 'Nova obra', route: '/obras/nova', glyph: 'glyph-contract' },
  ];

  constructor() {
    this.updateTitle();
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.url.set(event.urlAfterRedirects);
      this.updateTitle();
    });
  }

  @HostListener('window:online') setOnline(): void { this.online.set(true); }
  @HostListener('window:offline') setOffline(): void { this.online.set(false); }
  @HostListener('document:keydown.escape') closeMenu(): void { this.mobileOpen.set(false); }

  switchModule(module: 'm1' | 'm2'): void {
    this.mobileOpen.set(false);
    void this.router.navigateByUrl(module === 'm1' ? '/inicio' : '/obras/inicio');
  }
  logout(): void { this.auth.logout(); void this.router.navigateByUrl('/login'); }

  private updateTitle(): void {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    this.pageTitle.set(String(route.data['title'] ?? 'Visão geral'));
  }
}
