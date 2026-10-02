# Manual de Identidade Visual & Assets Oficiais — Brokiva

Este diretório contém os arquivos de marca oficiais e tratados da **Brokiva** em formato **PNG com canal alfa autêntico (RGBA 32-bit com transparência real)**, sem fundo quadriculado e recortados em alta definição para aplicação em sistemas web, extensões, documentos e materiais de marketing.

---

## 🎨 Paleta de Cores Oficial

| Elemento | Código Hex | RGB | Aplicação |
|---|---|---|---|
| **Navy Principal (Tipografia & Letra B)** | `#072143` | `rgb(7, 33, 67)` | Texto "Brokiva", contorno externo do ícone B e slogan |
| **Azul Real (Pontos de Conexão)** | `#0563F8` | `rgb(5, 99, 248)` | Dois círculos centrais do ícone B e pingo do "i" |
| **Verde Negócios (Ponto Final)** | `#00C853` / `#10B981` | `rgb(0, 200, 83)` | Ponto final do slogan ("viram negócios.") |
| **Branco Conexão** | `#FFFFFF` | `rgb(255, 255, 255)` | Trilha interna do ícone B e versão White do logo |
| **Azul Sovereign (Design System CRM)** | `#3742AC` | `rgb(55, 66, 172)` | Botões primários, destaques e foco na plataforma logada |

---

## 📁 Catálogo de Arquivos Disponíveis

### 1. Logo Completo (Horizontal com Slogan)
Ideal para cabeçalhos, barras de navegação, telas de login e materiais de apresentação.

- **Para Fundos Claros (Branco, Cinza, Gelo):**
  - **Arquivo:** [`brokiva-logo-v2.png`](file:///Users/rafaelsena/Desktop/Projetos-apps/CRM%20/public/brand/brokiva-logo-v2.png) *(e espelho `brokiva-logo-dark.png`)*
  - **Dimensões:** `1467 x 461 px`
  - **Fundo:** 100% Transparente (RGBA)
  - **Texto:** Azul Navy `#072143` com pontos azuis e verde.

- **Para Fundos Escuros (Preto, Navy, Grafite, Banners):**
  - **Arquivo:** [`brokiva-logo-white-v2.png`](file:///Users/rafaelsena/Desktop/Projetos-apps/CRM%20/public/brand/brokiva-logo-white-v2.png) *(e espelho `brokiva-logo-white.png`)*
  - **Dimensões:** `1467 x 461 px`
  - **Fundo:** 100% Transparente (RGBA)
  - **Texto:** Branco `#FFFFFF` com pontos azuis e verde preservados.

---

### 2. Ícone Simbólico (Letra B com Nós de Conexão)
Ideal para favicons, avatares, ícones de extensão do Chrome, badges e botões de aplicativo.

- **Arquivo:** [`brokiva-icon-v2.png`](file:///Users/rafaelsena/Desktop/Projetos-apps/CRM%20/public/brand/brokiva-icon-v2.png) *(e espelho `brokiva-icon.png`)*
- **Dimensões:** `717 x 848 px`
- **Fundo:** 100% Transparente (RGBA)
- **Estrutura:** Letra B em azul navy, trilha branca contínua e esferas azuis de relacionamento.

---

## 💻 Como Importar nos Projetos

### No Next.js / React (Web CRM):
```tsx
// Fundo claro (Tela de Login ou Sidebar)
<img 
  src="/brand/brokiva-logo-v2.png" 
  alt="Brokiva — Relacionamentos que viram negócios" 
  className="h-14 sm:h-16 w-auto object-contain" 
/>

// Fundo escuro (Modais ou Banners Escuros)
<img 
  src="/brand/brokiva-logo-white-v2.png" 
  alt="Brokiva — Relacionamentos que viram negócios" 
  className="h-10 w-auto object-contain" 
/>

// Apenas o Ícone
<img 
  src="/brand/brokiva-icon-v2.png" 
  alt="Brokiva" 
  className="w-10 h-10 object-contain" 
/>
```

### Na Extensão do Chrome (Brokiva):
Localizados em `icons/` nos formatos compatíveis:
- `icons/brokiva-logo-dark.png`
- `icons/brokiva-logo-white.png`
- `icons/icon128.png` (ou `icon48.png` / `icon16.png`)

---

*Arquivos gerados com processamento matemático de remoção de artefatos de fundo e preservação integral de antialiasing subpixel.*
