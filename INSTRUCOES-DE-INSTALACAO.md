# Locações e Recebíveis — Módulo 1

Este pacote contém o código-fonte completo da versão demonstrativa do Módulo 1.

## Sobre esta versão

- Todos os dados exibidos são fictícios.
- Não existe conexão com banco de dados real.
- Não são necessárias chaves de API ou credenciais externas para executar a demonstração localmente.
- As dependências não estão incluídas no ZIP e serão instaladas pelo npm.

## Requisitos

- Node.js 22.13.0 ou superior.
- npm, instalado junto com o Node.js.
- Aproximadamente 1 GB livre para instalar as dependências.

Confira as versões instaladas:

```bash
node --version
npm --version
```

## Instalação no Windows

1. Extraia o arquivo ZIP.
2. Abra a pasta extraída no Visual Studio Code.
3. Abra o terminal do Visual Studio Code dentro da pasta do projeto.
4. Instale as dependências:

```powershell
npm ci
```

5. Inicie o sistema:

```powershell
$env:WRANGLER_LOG_PATH=".wrangler/wrangler.log"
npx vite
```

6. Abra no navegador o endereço exibido no terminal. Normalmente será:

```text
http://localhost:5173
```

Para encerrar o sistema, pressione `Ctrl + C` no terminal.

## Instalação no Linux ou WSL

1. Extraia o arquivo ZIP e acesse a pasta do projeto no terminal.
2. Instale as dependências:

```bash
npm ci
```

3. Inicie o sistema:

```bash
npm run dev
```

4. Abra no navegador o endereço exibido no terminal, normalmente `http://localhost:5173`.

## Gerar a versão de produção

Os scripts de produção foram preparados para Linux ou WSL:

```bash
npm run build
npm run start
```

## Principais arquivos

- `app/page.tsx`: telas, fluxos e dados fictícios da demonstração.
- `app/globals.css`: identidade visual e responsividade.
- `app/layout.tsx`: estrutura geral e metadados.
- `package.json`: dependências e comandos do projeto.
- `.openai/hosting.json`: configuração de hospedagem do projeto original.

## Solução de problemas

### O comando `node` não é reconhecido

Instale o Node.js 22.13.0 ou superior e abra um novo terminal.

### A porta 5173 está ocupada

Inicie em outra porta:

```bash
npx vite --port 5174
```

Depois, acesse `http://localhost:5174`.

### A instalação apresentou erro

Confirme se a versão do Node.js é compatível e execute novamente:

```bash
npm ci
```

