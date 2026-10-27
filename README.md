# Apontamento de Campo — VIAR Bloco 1

App sem servidor: cada apontador instala no próprio celular, funciona **sem internet** e os dados ficam no aparelho.
A consolidação entre aparelhos é feita pela aba **Dados** (exportar/importar `.json`).

## Novidades da v8
- **Foto do painel/horímetro** no apontamento (câmera ou galeria), exibida na lista do dia.
- Aba **Equipes**: cadastrar, renomear e excluir equipes (alimenta todas as listas do app).
- **Foto** do equipamento (câmera ou galeria) no cadastro; aparece nas listas e na tela de apontamento.
- Relatórios: opção "Organizar por Equipe ou Equipamento" e filtro de equipamento (resumo por equipamento com dias operante/inoperante, eventos e horas).
- Removida a condição do tempo.
- Status **Operante / Inoperante**; se inoperante, escolher o evento: Chuva, Baixada, Folga, Manutenção ou Devolvido.
- Aba **Relatórios**: PDF e Excel (CSV) **diário** ou por **período**, com filtro de equipe.
  Colunas: equipe, prefixo, horímetro inicial e final, horas trabalhadas e status (com o evento).
- Cadastro de equipamento sem "valor de locação" e sem "nome/apelido" (identificação por **prefixo** e placa).
- Dados das versões anteriores são convertidos automaticamente na primeira abertura (o nome antigo vira prefixo, quando não havia prefixo).

## Publicar / instalar
1. Suba a pasta inteira para um endereço **HTTPS** (Netlify Drop, GitHub Pages, servidor da empresa…).
   Instalar como app exige HTTPS; abrindo o `index.html` direto do computador (file://) o app roda, mas não instala.
2. Cada apontador abre o link no celular. Android/Chrome: menu ⋮ → "Instalar aplicativo". iPhone/Safari: Compartilhar → "Adicionar à Tela de Início".
3. Atualização: o app busca a versão nova sozinho quando há internet (basta reabrir 1–2 vezes). Se não atualizar, limpe os dados do site ou reinstale.

## Importar cadastro em lote (aba Equipamentos)
Cole da planilha, nesta ordem de colunas: **Tipo, Equipe, Prefixo, Placa, Modelo, Locadora**.
Equipes que não existirem são criadas automaticamente.

## Fluxo diário de consolidação
1. Cada apontador lança no próprio celular.
2. No fim do dia: aba **Dados → Exportar** e enviar o arquivo por WhatsApp/e-mail.
3. Quem consolida: aba **Dados → Importar** (vários arquivos de uma vez; sem duplicar).
4. Aba **Relatórios** → escolher Diário ou Período, equipe → **Gerar PDF** / **Exportar Excel**.

## Atenção
- Limpar dados do navegador/desinstalar apaga os dados daquele aparelho: exporte com frequência.
- Fotos são reduzidas automaticamente (≈20–40 KB cada). O limite do navegador é ~5 MB por site; para centenas de equipamentos com foto prefira a versão com servidor.
