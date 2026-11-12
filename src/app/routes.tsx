export const routes = [
  {
    id: "dashboard",
    label: "Dashboard",
    description:
      "Visão geral do K86 Studio e ponto de partida para conectar o teclado.",
  },
  {
    id: "keys",
    label: "Keys",
    description:
      "Remapeamento de teclas e atalhos, com suporte ao layout ANSI sem cedilha.",
  },
  {
    id: "lighting",
    label: "Lighting",
    description:
      "Controle da iluminação RGB por tecla e dos efeitos do teclado.",
  },
  {
    id: "screen",
    label: "Screen",
    description:
      "Envie imagens e GIFs para a tela 240x135, com preview, frames e delay.",
  },
  {
    id: "macros",
    label: "Macros",
    description:
      "Gravação, edição e organização de sequências de teclas.",
  },
  {
    id: "settings",
    label: "Settings",
    description:
      "Perfis, preferências locais e diagnóstico do aplicativo.",
  },
  {
    id: "about",
    label: "About / Privacy",
    description:
      "Privacidade, licença GPL-3.0-or-later e os limites desta ferramenta.",
  },
] as const;

export type RouteId = (typeof routes)[number]["id"];
