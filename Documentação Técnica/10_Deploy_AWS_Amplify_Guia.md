# Guia de Deploy no AWS Amplify Hosting — crm.faithhubs.com

Passo a passo completo para hospedar a plataforma Vanguard CRM no **AWS Amplify Hosting** utilizando o repositório GitHub e o subdomínio `crm.faithhubs.com`.

---

## 🚀 Passo a Passo no Console da AWS Amplify

### 1. Criar Nova Aplicação no Amplify
1. Acesse o **Console da AWS** e abra o serviço **AWS Amplify**.
2. No menu lateral ou na página inicial, clique em **"Create new app"** (ou *"Host web app"*).
3. Selecione a origem do código: **GitHub** e clique em **Next**.
4. Autorize a AWS a acessar sua conta do GitHub (se ainda não estiver autorizada).
5. Selecione:
   - **Repository:** `r-fsena/com`
   - **Branch:** `main`
6. Clique em **Next**.

---

### 2. Configurações de Build
1. O Amplify detectará automaticamente o arquivo [`amplify.yml`](file:///Users/rafaelsena/Desktop/Projetos-apps/CRM%20/amplify.yml) que já criamos na raiz do projeto.
2. Na seção **Advanced settings (Variáveis de Ambiente)**, você pode adicionar variáveis se desejar (ou configurar posteriormente em *Environment variables*):
   - `DATABASE_URL` (se já possuir o PostgreSQL)
   - `ZAPI_WEBHOOK_SECRET`
3. Clique em **Next** e depois em **Save and deploy**.

O Amplify iniciará o pipeline automático de build (Provision -> Build -> Deploy -> Verify) que leva cerca de 2 a 3 minutos.

---

## 🌐 3. Configurar o Domínio `crm.faithhubs.com` no Amplify

Como você já tem o domínio `faithhubs.com` na AWS:

1. No menu lateral do seu app no Amplify, clique em **Domain management** (Gerenciamento de domínio).
2. Clique no botão **Add domain** (ou *Manage subdomains* se o `faithhubs.com` já estiver listado).
3. Se adicionar o domínio principal:
   - Digite `faithhubs.com` e clique em **Configure domain**.
4. Na tabela de subdomínios:
   - Defina o subdomínio **`crm`** apontando para a branch **`main`**.
   - Remova o apontamento da raiz se o site principal estiver em outro app/serviço, deixando apenas:
     - `crm.faithhubs.com` -> `main`
5. Clique em **Save**.

---

## 🔒 4. Certificado SSL Automático
- O AWS Amplify emitirá e renovará o certificado SSL (HTTPS) automaticamente via **Amazon Certificate Manager (ACM)**.
- Se o domínio estiver no **Route 53**, o apontamento DNS é feito com 1 clique.
- Se o domínio estiver no **Cloudflare/Registro.br**, o Amplify mostrará os registros CNAME para colar no seu gerenciador DNS.
