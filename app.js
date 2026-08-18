/* ==========================================================
   RGS Coffee Machine — interações da landing page
   ========================================================== */
(function () {
  'use strict';

  var $ = function (s, c) {
    return (c || document).querySelector(s);
  };
  var $$ = function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };

  /* ==========================================================
     CONFIGURAÇÃO DE ENTREGA DO LEAD
     ----------------------------------------------------------
     DESTINO: contato@rgscoffeemachine.com.br

     Existem dois caminhos. O código tenta o `webhook` primeiro;
     se ele estiver vazio, usa o `formsubmit`.

     1) webhook (recomendado em produção)
        Cole aqui a URL do webhook do N8N. O N8N recebe o JSON
        completo e faz: envio do e-mail para contato@, criação do
        deal no CRM, disparo do template de WhatsApp e abertura da
        conversa no Chatwoot. É o caminho com log e reprocessamento.

     2) formsubmit (funciona sem backend)
        Serviço gratuito que entrega o formulário direto na caixa
        de entrada. IMPORTANTE: na primeira submissão feita no
        domínio publicado, o FormSubmit envia um e-mail de ativação
        para contato@rgscoffeemachine.com.br. É preciso clicar no
        link desse e-mail uma única vez. Antes disso nada chega.

     Se os dois falharem, o site abre o cliente de e-mail do
     visitante com o resumo já escrito — o lead nunca é perdido.
     ========================================================== */
  var LEAD = {
    /* para onde vai a notificação interna */
    destino: 'contato@rgscoffeemachine.com.br',

    /* cópia opcional: outro e-mail que também recebe cada lead.
       Ex.: 'comercial@rgscoffeemachine.com.br' ou o e-mail do dono.
       Aceita vários separados por vírgula. Deixe '' para não usar. */
    copia: 'comercial@rgscoffeemachine.com.br',

    /* ETAPA 1 — notificação para a RGS via PROXY PHP
       Como alguns adblockers bloqueiam o FormSubmit, e o servidor bloqueia o mail(), 
       criamos um proxy que envia pelo servidor sem usar a função mail(). */
    formsubmit: 'enviar.php',

    /* ETAPA 2 — confirmação automática para o cliente (EmailJS, 200/mês grátis)
       Preencha os três valores do painel do EmailJS. Enquanto estiverem
       vazios, o site só envia a notificação interna e não quebra nada. */
    emailjs: {
      publicKey: 'DCIkA8tbaD4qVcHg3',
      serviceId: 'service_hdi1x4k',
      templateId: 'template_y5ahtcf'
    },

    /* Chave DE SITE do Google reCAPTCHA v2 Invisível.
       É a proteção da chave do EmailJS no plano gratuito: o Google só emite
       token para os domínios que você cadastrar, então a chave pública do
       EmailJS não funciona fora do rgscoffeemachine.com.br.
       Vazio = confirmação sai sem verificação (funciona, mas sem proteção). */
    recaptchaSiteKey: '',

    /* webhook próprio (N8N, Make, Zapier). Se preenchido, substitui a
       etapa 1 e recebe o JSON completo. Opcional. */
    webhook: '',

    copiaWhatsapp: '5519974061692'
  };

  var LABELS = {
    origem: 'Origem',
    empresa: 'Empresa',
    cnpj: 'CNPJ',
    cep: 'CEP',
    cidade: 'Cidade',
    endereco: 'Endereço',
    nome: 'Responsável',
    cargo: 'Cargo',
    email: 'E-mail',
    whatsapp: 'Telefone / WhatsApp',
    colaboradores: 'Colaboradores',
    unidades: 'Unidades',
    segmento: 'Segmento',
    turnos: 'Turnos',
    pontos: 'Pontos de café',
    cenario_atual: 'Cenário atual',
    vencimento_contrato: 'Vencimento do contrato atual',
    necessidades: 'Necessidades',
    menu: 'Menu de bebidas',
    prazo: 'Prazo de decisão',
    proximo_passo: 'Próximo passo pedido',
    observacoes: 'Observações',
    plano_sugerido: 'Plano sugerido',
    doses_mes: 'Doses estimadas por mês',
    kg_mes: 'Grão estimado por mês (kg)',
    lead_score: 'Lead score',
    faixa: 'Faixa de prioridade',
    sla_resposta: 'SLA de resposta',
    utm_source: 'utm_source',
    utm_medium: 'utm_medium',
    utm_campaign: 'utm_campaign',
    gclid: 'gclid',
    pagina_origem: 'Página de origem'
  };

  var ORDEM = [
    'origem', 'faixa', 'sla_resposta', 'lead_score', 'proximo_passo',
    'empresa', 'cnpj', 'segmento', 'cidade', 'cep', 'endereco', 'unidades',
    'nome', 'cargo', 'email', 'whatsapp',
    'colaboradores', 'turnos', 'pontos', 'cenario_atual',
    'vencimento_contrato', 'necessidades', 'menu', 'prazo',
    'plano_sugerido', 'doses_mes', 'kg_mes', 'observacoes',
    'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'pagina_origem'
  ];

  /* monta o resumo em texto legível, na ordem de leitura do consultor */
  function resumoTexto(payload, titulo) {
    var linhas = [titulo, ''.padEnd ? '='.repeat(46) : '=============================================='];
    function fmt(k, v) {
      if (Array.isArray(v)) return v.join(', ');
      if (typeof v === 'string') return v.split(',').join(', ').replace(/\s+/g, ' ');
      if (typeof v === 'number' && ['doses_mes', 'kg_mes', 'colaboradores'].indexOf(k) !== -1)
        return v.toLocaleString('pt-BR');
      return String(v);
    }
    ORDEM.forEach(function (k) {
      var v = payload[k];
      if (v === undefined || v === null || v === '' || v === '—') return;
      linhas.push((LABELS[k] || k) + ': ' + fmt(k, v));
    });
    Object.keys(payload).forEach(function (k) {
      if (ORDEM.indexOf(k) !== -1) return;
      var v = payload[k];
      if (v === undefined || v === null || v === '') return;
      linhas.push((LABELS[k] || k) + ': ' + fmt(k, v));
    });
    linhas.push('');
    linhas.push('Recebido em: ' + new Date().toLocaleString('pt-BR'));
    linhas.push('Enviado automaticamente pelo site rgscoffeemachine.com.br');
    return linhas.join('\n');
  }

  /* abre o cliente de e-mail com o resumo pronto — rede indisponível */
  function mailtoFallback(payload, assunto) {
    return (
      'mailto:' +
      LEAD.destino +
      '?subject=' +
      encodeURIComponent(assunto) +
      '&body=' +
      encodeURIComponent(resumoTexto(payload, assunto))
    );
  }

  /* ---------- reCAPTCHA v2 Invisível ----------
     Carrega sob demanda e devolve um token por envio. Sem caixinha para
     marcar: o visitante não vê nada além do selo do Google no canto. */
  var RC = { promessa: null, widget: null, pendente: null };

  function carregarRecaptcha() {
    if (!LEAD.recaptchaSiteKey) return Promise.resolve(null);
    if (RC.promessa) return RC.promessa;

    RC.promessa = new Promise(function (ok, falha) {
      var limite = setTimeout(function () {
        falha(new Error('reCAPTCHA demorou demais para carregar'));
      }, 12000);

      window.__rgsRecaptchaPronto = function () {
        clearTimeout(limite);
        try {
          var caixa = document.createElement('div');
          caixa.id = 'rgs-recaptcha';
          caixa.style.display = 'none';
          document.body.appendChild(caixa);
          RC.widget = window.grecaptcha.render(caixa, {
            sitekey: LEAD.recaptchaSiteKey,
            size: 'invisible',
            badge: 'bottomright',
            callback: function (token) {
              if (RC.pendente) { RC.pendente.ok(token); RC.pendente = null; }
            },
            'error-callback': function () {
              if (RC.pendente) {
                RC.pendente.falha(new Error('reCAPTCHA falhou'));
                RC.pendente = null;
              }
            },
            'expired-callback': function () {
              if (RC.pendente) {
                RC.pendente.falha(new Error('reCAPTCHA expirou'));
                RC.pendente = null;
              }
            }
          });
          ok(RC.widget);
        } catch (e) {
          falha(e);
        }
      };

      var tag = document.createElement('script');
      tag.src =
        'https://www.google.com/recaptcha/api.js?onload=__rgsRecaptchaPronto&render=explicit';
      tag.async = true;
      tag.defer = true;
      tag.onerror = function () {
        clearTimeout(limite);
        falha(new Error('não foi possível carregar o reCAPTCHA'));
      };
      document.head.appendChild(tag);
    });

    return RC.promessa;
  }

  function tokenRecaptcha() {
    if (!LEAD.recaptchaSiteKey) return Promise.resolve('');
    return carregarRecaptcha().then(function (widget) {
      return new Promise(function (ok, falha) {
        var limite = setTimeout(function () {
          RC.pendente = null;
          falha(new Error('reCAPTCHA não respondeu'));
        }, 15000);
        RC.pendente = {
          ok: function (t) { clearTimeout(limite); ok(t); },
          falha: function (e) { clearTimeout(limite); falha(e); }
        };
        try {
          window.grecaptcha.reset(widget);
          window.grecaptcha.execute(widget);
        } catch (e) {
          clearTimeout(limite);
          RC.pendente = null;
          falha(e);
        }
      });
    });
  }

  /* ---------- limite de reenvio no próprio navegador ----------
     Segunda camada, independente do reCAPTCHA: no máximo 3 confirmações por
     hora e nunca duas para o mesmo e-mail em menos de 10 minutos. Protege a
     cota de 200/mês contra recarregamentos e envios repetidos.
     Guardado em cookie de 1 hora — se o navegador bloquear, o fluxo segue
     normalmente, apenas sem esse limite. */
  function lerRegistro() {
    var m = document.cookie.match(/(?:^|;\s*)rgs_conf=([^;]*)/);
    if (!m) return [];
    try {
      var v = JSON.parse(decodeURIComponent(m[1]));
      return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
    } catch (e) {
      return [];
    }
  }

  function gravarRegistro(reg) {
    document.cookie =
      'rgs_conf=' +
      encodeURIComponent(JSON.stringify(reg)) +
      '; max-age=3600; path=/; SameSite=Lax';
  }

  function podeConfirmar(email) {
    try {
      var agora = Date.now();
      var reg = lerRegistro().filter(function (r) {
        return r && r.t && agora - r.t < 3600000;
      });
      if (reg.length >= 3) return { ok: false, motivo: 'limite por hora' };
      var igual = reg.filter(function (r) {
        return r.e === email && agora - r.t < 600000;
      });
      if (igual.length) return { ok: false, motivo: 'e-mail repetido' };
      reg.push({ e: email, t: agora });
      gravarRegistro(reg);
      return { ok: true };
    } catch (e) {
      return { ok: true };
    }
  }

  /* ---------- confirmação automática para o cliente (EmailJS) ----------
     Envia um e-mail de "recebemos sua solicitação" para quem preencheu.
     Falha aqui NÃO bloqueia o lead: a notificação interna é o que importa. */
  function confirmarParaCliente(payload) {
    var cfg = LEAD.emailjs;
    if (!cfg.publicKey || !cfg.serviceId || !cfg.templateId) {
      return Promise.resolve({ via: 'desativado' });
    }
    if (typeof window.emailjs === 'undefined') {
      return Promise.reject(new Error('SDK do EmailJS não carregou'));
    }
    if (!payload.email) {
      return Promise.resolve({ via: 'sem e-mail' });
    }

    var limite = podeConfirmar(payload.email);
    if (!limite.ok) {
      if (window.console)
        console.warn('[RGS] confirmação não reenviada: ' + limite.motivo);
      return Promise.resolve({ via: 'bloqueado', motivo: limite.motivo });
    }

    var primeiroNome = (payload.nome || '').split(' ')[0] || '';
    var prazo = payload.sla_resposta
      ? 'em até ' + payload.sla_resposta
      : 'em até 2 horas úteis';

    var passo = {
      'Degustação na empresa':
        'Vamos entrar em contato para confirmar a data da degustação na sua empresa, sem custo.',
      'Visita técnica de levantamento':
        'Nossa equipe técnica entra em contato para agendar o levantamento no local.',
      'Ligação de um consultor':
        'Um consultor vai ligar no número que você informou.',
      'Só a proposta por e-mail':
        'Vamos preparar a proposta e enviar para este mesmo e-mail.'
    };

    var params = {
      to_email: payload.email,
      to_name: primeiroNome || payload.nome || 'tudo bem',
      nome: payload.nome || '',
      empresa: payload.empresa || '',
      cidade: payload.cidade || '',
      colaboradores: payload.colaboradores
        ? Number(payload.colaboradores).toLocaleString('pt-BR')
        : '',
      plano: payload.plano_sugerido || '',
      doses: payload.doses_mes
        ? Number(payload.doses_mes).toLocaleString('pt-BR')
        : '',
      kg: payload.kg_mes ? Number(payload.kg_mes).toLocaleString('pt-BR') : '',
      proximo_passo: payload.proximo_passo || '',
      proximo_passo_texto:
        passo[payload.proximo_passo] ||
        'Vamos preparar a proposta e enviar para este mesmo e-mail.',
      prazo: prazo,
      resumo: resumoTexto(payload, 'Resumo da sua solicitação'),
      reply_to: LEAD.destino
    };

    return tokenRecaptcha()
      .then(function (token) {
        if (token) params['g-recaptcha-response'] = token;
        return window.emailjs.send(cfg.serviceId, cfg.templateId, params, {
          publicKey: cfg.publicKey
        });
      })
      .then(function () {
        return { via: 'emailjs' };
      });
  }

  /* entrega o lead: webhook do N8N > FormSubmit > fallback mailto */
  function notificarRGS(payload, assunto) {
    var resumo = resumoTexto(payload, assunto);

    if (LEAD.webhook) {
      return fetch(LEAD.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destino: LEAD.destino,
          assunto: assunto,
          resumo: resumo,
          dados: payload
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('webhook ' + res.status);
        return { via: 'webhook' };
      });
    }

    var corpo = {
      _subject: assunto,
      _template: 'table',
      _captcha: 'false',
      _replyto: payload.email,
      Resumo: resumo
    };
    if (LEAD.copia) corpo._cc = LEAD.copia;
    ORDEM.forEach(function (k) {
      var v = payload[k];
      if (v === undefined || v === null || v === '') return;
      corpo[LABELS[k] || k] = Array.isArray(v)
        ? v.join(', ')
        : typeof v === 'string'
          ? v.split(',').join(', ')
          : String(v);
    });
    if (payload.email) corpo._replyto = payload.email;

    return fetch(LEAD.formsubmit, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (res) {
      if (!res.ok) throw new Error('formsubmit ' + res.status);
      return res.json().catch(function () {
        return {};
      });
    }).then(function (j) {
      if (j && j.success === 'false') throw new Error(j.message || 'formsubmit recusou');
      return { via: 'formsubmit' };
    });
  }

  /* Orquestra os dois e-mails de uma vez.
     Regra: o lead só é considerado entregue se a RGS foi notificada.
     A confirmação para o cliente é um extra — se ela falhar, o lead
     segue válido e apenas registramos o aviso no console. */
  function enviarLead(payload, assunto) {
    var interno = notificarRGS(payload, assunto);
    var externo = confirmarParaCliente(payload).catch(function (err) {
      if (window.console)
        console.warn('[RGS] confirmação para o cliente não saiu:', err);
      return { via: 'falhou' };
    });
    return Promise.all([interno, externo]).then(function (r) {
      return { interno: r[0], confirmacao: r[1] };
    });
  }

  /* ---------- tema ---------- */
  (function theme() {
    var btn = $('[data-theme-toggle]');
    var root = document.documentElement;
    var mode = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

    function icons(m) {
      return m === 'dark'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }

    root.setAttribute('data-theme', mode);
    if (!btn) return;
    btn.innerHTML = icons(mode);
    btn.addEventListener('click', function () {
      mode = mode === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', mode);
      btn.innerHTML = icons(mode);
      btn.setAttribute(
        'aria-label',
        'Ativar modo ' + (mode === 'dark' ? 'claro' : 'escuro')
      );
    });
  })();

  /* ---------- header + menu mobile ---------- */
  (function header() {
    var el = $('#header');
    var burger = $('#burger');
    var nav = $('#nav');

    window.addEventListener(
      'scroll',
      function () {
        el.classList.toggle('header--scrolled', window.scrollY > 12);
      },
      { passive: true }
    );

    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = nav.getAttribute('data-open') === 'true';
        nav.setAttribute('data-open', String(!open));
        burger.setAttribute('aria-expanded', String(!open));
      });
      $$('a', nav).forEach(function (a) {
        a.addEventListener('click', function () {
          nav.setAttribute('data-open', 'false');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }
  })();

  /* ---------- CTA fixa mobile ---------- */
  (function mobileCta() {
    var bar = $('#mobile-cta');
    var quote = $('#orcamento');
    if (!bar) return;
    window.addEventListener(
      'scroll',
      function () {
        var pastHero = window.scrollY > 480;
        var inForm =
          quote &&
          quote.getBoundingClientRect().top < window.innerHeight * 0.6 &&
          quote.getBoundingClientRect().bottom > 0;
        bar.setAttribute('data-show', String(pastHero && !inForm));
      },
      { passive: true }
    );
  })();

  /* ---------- reveal on scroll ---------- */
  (function reveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (i) {
        i.setAttribute('data-in', 'true');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', 'true');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    items.forEach(function (i) {
      io.observe(i);
    });
  })();

  /* ---------- seletor de planos ---------- */
  (function plans() {
    var picks = $$('[data-plan-pick]');
    var cards = $$('[data-plan]');
    picks.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-plan-pick');
        picks.forEach(function (p) {
          p.setAttribute('aria-pressed', String(p === b));
        });
        cards.forEach(function (c) {
          c.setAttribute(
            'data-active',
            String(c.getAttribute('data-plan') === key)
          );
        });
      });
    });
  })();

  /* ---------- filtro do catálogo ---------- */
  (function catalog() {
    var btns = $$('[data-filter]');
    var skus = $$('.sku');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        btns.forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        skus.forEach(function (s) {
          var apps = s.getAttribute('data-apps') || '';
          s.hidden = !(f === 'all' || apps.indexOf(f) > -1);
        });
      });
    });
  })();

  /* ---------- utilidades ---------- */
  var brl = function (n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  };
  var num = function (n) {
    return Math.round(n).toLocaleString('pt-BR');
  };
  var FREE_MAIL = [
    'gmail.',
    'hotmail.',
    'outlook.',
    'yahoo.',
    'live.',
    'icloud.',
    'bol.com',
    'uol.com',
    'terra.com',
    'msn.com',
    'proton.me',
    'protonmail.'
  ];
  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v).trim());
  }
  function isCorporate(v) {
    var d = String(v).toLowerCase();
    return !FREE_MAIL.some(function (f) {
      return d.indexOf('@' + f) > -1 || d.indexOf(f) > d.indexOf('@');
    });
  }

  /* ==========================================================
     CALCULADORA DE CONSUMO CORPORATIVO
     Premissas: 7 g por dose de espresso, rendimento aproximado
     de 140 doses por quilo de grão. Faixas de investimento são
     estimativas de orientação, confirmadas na proposta.
     ========================================================== */
  var CALC = {
    people: 120,
    cups: 2.5,
    days: 22,
    shifts: 1,
    now: 'coado',
    spend: null,
    points: 2,
    milk: 30,
    guests: 10
  };

  var GRAMS_PER_DOSE = 7;
  var DOSES_PER_KG = 1000 / GRAMS_PER_DOSE; // ≈ 143
  // Custo de referência por dose para o cenário atual (premissa a validar).
  var NOW_COST = { coado: 0.42, capsula: 1.85, propria: 0.55, nada: 0 };

  // Valores reais de locação de máquina por ponto (R$/mês)
  var MACHINE_PRICE = {
    essencial: 250,   // Máquina Pequena (R$ 250/mês)
    corporativo: 490, // Máquina Média (R$ 490/mês)
    industrial: 690,  // Máquina Grande (R$ 690/mês)
    vending: 690      // Máquina Grande (R$ 690/mês)
  };

  // Preço do café por kg (R$ 79,90 a R$ 115,00/kg) - Padrão Premium: R$ 91,90
  var COFFEE_PRICE_KG = {
    tradicional: 79.90, // Café Tradicional
    superior: 89.90,    // Café Superior
    premium: 91.90,     // Café Premium (padrão)
    gourmet: 115.00     // Café Gourmet
  };

  function planFor(doses, people, shifts) {
    if (shifts === 3 || people > 300 || doses > 14000) {
      return {
        key: 'vending',
        name: 'Vending 24/7',
        machine: 'Bianchi LEI e linha vending (Máquina Grande)'
      };
    }
    if (people > 100 || doses > 4500) {
      return {
        key: 'industrial',
        name: 'Industrial',
        machine: "Bianchi / Evoca (Máquina Grande)"
      };
    }
    if (people > 25 || doses > 1200) {
      return {
        key: 'corporativo',
        name: 'Corporativo',
        machine: 'Saeco / Gaggia (Máquina Média)'
      };
    }
    return {
      key: 'essencial',
      name: 'Essencial',
      machine: "Saeco / De'Longhi (Máquina Pequena)"
    };
  }

  function compute() {
    var dailyStaff = CALC.people * CALC.cups;
    var dailyGuests = CALC.guests * 1.2;
    var shiftFactor = CALC.shifts === 3 ? 1.35 : CALC.shifts === 2 ? 1.18 : 1;
    var perDay = (dailyStaff + dailyGuests) * shiftFactor;
    var monthly = perDay * CALC.days;

    // bebidas com leite usam a mesma dose de café; o leite entra como insumo.
    var kg = monthly / DOSES_PER_KG;

    // pico: ~15% do volume diário concentrado na hora de maior fluxo,
    // diluído pelo número de pontos disponíveis.
    var peak = (perDay * 0.15) / Math.max(1, CALC.points);

    var plan = planFor(monthly, CALC.people, CALC.shifts);

    var nowCost =
      CALC.spend !== null && CALC.spend > 0
        ? CALC.spend
        : monthly * NOW_COST[CALC.now];

    // Custo real RGS:
    // 1. Locação de máquinas = pontos * valor real por máquina (250, 490 ou 690)
    var machineRental = CALC.points * (MACHINE_PRICE[plan.key] || 490);

    // 2. Custo de café em grão (mín: Tradicional R$79.90, máx: Gourmet R$115.00, médio: Premium R$91.90)
    var coffeeMin = kg * COFFEE_PRICE_KG.tradicional;
    var coffeeMid = kg * COFFEE_PRICE_KG.premium;
    var coffeeMax = kg * COFFEE_PRICE_KG.gourmet;

    // 3. Insumos adicionais (leite, chocolate, descartáveis ~ R$ 20/kg + adicional de leite)
    var milkAdd = (CALC.milk / 100) * 12.00;
    var suppliesCost = kg * (20.00 + milkAdd);

    var rgsMin = machineRental + coffeeMin + (suppliesCost * 0.9);
    var rgsMax = machineRental + coffeeMax + (suppliesCost * 1.1);
    var rgsMid = machineRental + coffeeMid + suppliesCost;

    return {
      perDay: perDay,
      monthly: monthly,
      kg: kg,
      peak: peak,
      plan: plan,
      nowCost: nowCost,
      rgsMin: rgsMin,
      rgsMax: rgsMax,
      rgsMid: rgsMid,
      save: Math.max(0, nowCost - rgsMid) * 12
    };
  }

  function score(r) {
    var s = 0;
    if (CALC.people >= 300) s += 30;
    else if (CALC.people >= 100) s += 22;
    else if (CALC.people >= 26) s += 14;
    else s += 6;
    if (CALC.shifts === 3) s += 10;
    else if (CALC.shifts === 2) s += 6;
    if (CALC.points >= 3) s += 6;
    if (CALC.now === 'capsula') s += 10;
    if (CALC.now === 'coado') s += 6;
    if (CALC.spend && CALC.spend > 1500) s += 8;
    return s;
  }

  function renderCalc() {
    var r = compute();

    $('#c-people-out').textContent = num(CALC.people);
    $('#c-cups-out').textContent = String(CALC.cups).replace('.', ',');
    $('#c-days-out').textContent = CALC.days;
    $('#c-points').textContent = CALC.points;
    $('#c-milk').textContent = CALC.milk + '%';
    $('#c-guests').textContent = CALC.guests;

    $('#r-plan').textContent = r.plan.name;
    $('#r-machine').textContent =
      r.plan.machine +
      ' · ' +
      CALC.points +
      (CALC.points > 1 ? ' pontos' : ' ponto');
    $('#r-doses').textContent = num(r.monthly);
    $('#r-kg').textContent = num(r.kg) + ' kg';
    $('#r-day').textContent = num(r.perDay);
    $('#r-peak').textContent = num(r.peak);

    var isNothing = CALC.now === 'nada' && !CALC.spend;
    var max = Math.max(r.nowCost, r.rgsMax, 1);

    $('#r-now').textContent = isNothing
      ? 'Sem café hoje'
      : brl(r.nowCost) + ' /mês';
    $('#r-now-bar').style.width = (r.nowCost / max) * 100 + '%';

    $('#r-rgs').textContent = brl(r.rgsMin) + ' a ' + brl(r.rgsMax) + ' /mês';
    $('#r-rgs-bar').style.width = (r.rgsMid / max) * 100 + '%';

    if (isNothing) {
      $('#r-save').textContent = num(r.monthly * 12);
      $('#r-save-label').textContent =
        'doses de café servidas por ano — o ganho aqui é de benefício e imagem, não de corte de custo';
    } else if (r.save > 0) {
      $('#r-save').textContent = brl(r.save);
      $('#r-save-label').textContent =
        'de economia potencial em 12 meses, mantido o mesmo volume de consumo';
    } else {
      $('#r-save').textContent = brl(r.rgsMid);
      $('#r-save-label').textContent =
        'investimento mensal estimado — com manutenção, insumo e SLA de 4h inclusos';
    }

    // repassa para o formulário
    var fp = $('#f-plan');
    var fd = $('#f-doses');
    if (fp) fp.value = r.plan.name;
    if (fd) fd.value = Math.round(r.monthly);
  }

  (function calcBind() {
    if (!$('#c-people')) return;

    $('#c-people').addEventListener('input', function (e) {
      CALC.people = +e.target.value;
      renderCalc();
    });
    $('#c-cups').addEventListener('input', function (e) {
      CALC.cups = +e.target.value;
      renderCalc();
    });
    $('#c-days').addEventListener('input', function (e) {
      CALC.days = +e.target.value;
      renderCalc();
    });
    $('#c-spend').addEventListener('input', function (e) {
      var v = parseFloat(e.target.value);
      CALC.spend = isNaN(v) || v <= 0 ? null : v;
      renderCalc();
    });

    $$('[data-shift]').forEach(function (b) {
      b.addEventListener('click', function () {
        CALC.shifts = +b.getAttribute('data-shift');
        $$('[data-shift]').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        renderCalc();
      });
    });

    $$('[data-now]').forEach(function (b) {
      b.addEventListener('click', function () {
        CALC.now = b.getAttribute('data-now');
        $$('[data-now]').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        renderCalc();
      });
    });

    var LIMITS = {
      points: [1, 12, 1],
      milk: [0, 100, 5],
      guests: [0, 200, 5]
    };
    $$('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-step');
        var dir = +b.getAttribute('data-dir');
        var lim = LIMITS[k];
        CALC[k] = Math.min(lim[1], Math.max(lim[0], CALC[k] + dir * lim[2]));
        renderCalc();
      });
    });

    renderCalc();
  })();

  /* ---------- captura do relatório da calculadora ---------- */
  (function gate() {
    var form = $('#gate-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#gate-email');
      var err = $('#gate-email-err');
      var ok = validEmail(email.value);
      err.setAttribute('data-show', String(!ok));
      email.setAttribute('aria-invalid', String(!ok));
      if (!ok) {
        email.focus();
        return;
      }
      if (!isCorporate(email.value)) {
        err.textContent =
          'Prefira o e-mail corporativo — agiliza a emissão da proposta.';
        err.setAttribute('data-show', 'true');
      }
      form.style.display = 'none';
      $('#gate-copy').style.display = 'none';
      $('#gate-done').setAttribute('data-show', 'true');

      var r = compute();
      var CENARIO = {
        coado: 'Coado / garrafa térmica',
        capsula: 'Cápsulas',
        propria: 'Máquina própria',
        nada: 'Não tem café hoje'
      };

      var payload = {
        origem: 'Calculadora de consumo',
        email: email.value.trim(),
        whatsapp: ($('#gate-phone').value || '').trim(),
        colaboradores: CALC.people,
        turnos: CALC.shifts + (CALC.shifts > 1 ? ' turnos' : ' turno'),
        pontos: CALC.points,
        cenario_atual: CENARIO[CALC.now] || CALC.now,
        doses_mes: Math.round(r.monthly),
        kg_mes: Math.round(r.kg),
        plano_sugerido: r.plan.name,
        lead_score: score(r)
      };
      if (window.console) console.log('[RGS] lead calculadora', payload);

      var assuntoCalc =
        '[Site] Memorial da calculadora — ' +
        payload.email +
        ' (' +
        payload.colaboradores +
        ' colaboradores, ' +
        payload.plano_sugerido +
        ')';

      notificarRGS(payload, assuntoCalc).catch(function (err) {
        if (window.console) console.warn('[RGS] falha no envio da calculadora', err);
        var aviso = $('#gate-fallback');
        if (aviso) {
          var l = $('#gate-fallback-mail');
          if (l) l.href = mailtoFallback(payload, assuntoCalc);
          aviso.setAttribute('data-show', 'true');
        }
      });

      // pré-preenche o formulário principal
      if ($('#f-email') && !$('#f-email').value)
        $('#f-email').value = email.value.trim();
      if ($('#f-phone') && !$('#f-phone').value)
        $('#f-phone').value = ($('#gate-phone').value || '').trim();
      if ($('#f-people') && !$('#f-people').value)
        $('#f-people').value = CALC.people;
    });
  })();

  /* ==========================================================
     FORMULÁRIO DE ORÇAMENTO — 4 etapas
     ========================================================== */
  (function quoteForm() {
    var form = $('#quote-form');
    if (!form) return;

    var steps = $$('.step', form);
    var total = steps.length;
    var current = 1;
    var picked = {};

    var titles = [
      'Sua operação',
      'Cenário atual',
      'Dados da empresa',
      'Contato e agendamento'
    ];

    /* --- chips (single e multi) --- */
    $$('.chips[id^="grp-"]', form).forEach(function (grp) {
      var multi = grp.getAttribute('data-multi') === 'true';
      var key = grp.id.replace('grp-', '');
      $$('.chip', grp).forEach(function (chip) {
        chip.setAttribute('aria-pressed', 'false');
        chip.addEventListener('click', function () {
          if (multi) {
            var on = chip.getAttribute('aria-pressed') === 'true';
            chip.setAttribute('aria-pressed', String(!on));
            picked[key] = $$('.chip[aria-pressed="true"]', grp).map(function (c) {
              return c.getAttribute('data-val');
            });
          } else {
            $$('.chip', grp).forEach(function (c) {
              c.setAttribute('aria-pressed', String(c === chip));
            });
            picked[key] = chip.getAttribute('data-val');
          }
          hideErr(key);
          conditional();
        });
      });
    });

    function conditional() {
      var w = $('#wrap-contract');
      var show =
        picked.now === 'Locação com outro fornecedor' ||
        picked.now === 'Máquina própria';
      if (w) w.hidden = !show;
    }

    /* --- máscaras --- */
    function mask(el, fn) {
      if (!el) return;
      el.addEventListener('input', function () {
        var pos = el.value.length;
        el.value = fn(el.value);
        if (pos >= el.value.length) el.setSelectionRange(el.value.length, el.value.length);
      });
    }

    mask($('#f-cnpj'), function (v) {
      var d = v.replace(/\D/g, '').slice(0, 14);
      return d
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    });

    mask($('#f-cep'), function (v) {
      var d = v.replace(/\D/g, '').slice(0, 8);
      return d.replace(/^(\d{5})(\d)/, '$1-$2');
    });

    mask($('#f-phone'), function (v) {
      var d = v.replace(/\D/g, '').slice(0, 11);
      if (d.length <= 10)
        return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
      return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
    });

    /* --- autocomplete de CEP --- */
    var cep = $('#f-cep');
    if (cep) {
      cep.addEventListener('blur', function () {
        var d = cep.value.replace(/\D/g, '');
        if (d.length !== 8) return;
        var status = $('#cep-status');
        if (status) status.textContent = 'Buscando endereço...';
        fetch('https://viacep.com.br/ws/' + d + '/json/')
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            if (data.erro) {
              if (status) status.textContent = 'CEP não encontrado — preencha manualmente.';
              return;
            }
            if ($('#f-city') && !$('#f-city').value) $('#f-city').value = data.localidade || '';
            if ($('#f-address') && !$('#f-address').value) {
              $('#f-address').value = [data.logradouro, data.bairro]
                .filter(Boolean)
                .join(' — ');
            }
            hideErr('city');
            if (status) status.textContent = 'Endereço preenchido automaticamente.';
          })
          .catch(function () {
            if (status) status.textContent = 'Não foi possível buscar o CEP — preencha manualmente.';
          });
      });
    }

    /* --- erros --- */
    function showErr(key, el, msg) {
      var e = $('#f-' + key + '-err');
      if (e) {
        if (msg) e.textContent = msg;
        e.setAttribute('data-show', 'true');
      }
      if (el) el.setAttribute('aria-invalid', 'true');
    }
    function hideErr(key, el) {
      var e = $('#f-' + key + '-err');
      if (e) e.setAttribute('data-show', 'false');
      if (el) el.removeAttribute('aria-invalid');
    }
    ['people', 'company', 'cnpj', 'cep', 'city', 'name', 'email', 'phone'].forEach(
      function (k) {
        var el = $('#f-' + k);
        if (el)
          el.addEventListener('input', function () {
            hideErr(k, el);
          });
      }
    );
    ['units', 'when', 'role'].forEach(function (k) {
      var el = $('#f-' + k);
      if (el)
        el.addEventListener('change', function () {
          hideErr(k, el);
        });
    });

    /* --- validação por etapa --- */
    function validate(step) {
      var ok = true;
      var first = null;

      function bad(key, el, msg) {
        showErr(key, el, msg);
        ok = false;
        if (!first) first = el || $('#f-' + key + '-err');
      }

      if (step === 1) {
        var p = $('#f-people');
        if (!p.value || +p.value < 1) bad('people', p);
        else hideErr('people', p);

        var u = $('#f-units');
        if (!u.value) bad('units', u);
        else hideErr('units', u);

        if (!picked.seg) bad('seg', null);
        if (!picked.shift) bad('shift', null);
      }

      if (step === 2) {
        if (!picked.now) bad('now', null);
        if (!picked.need || !picked.need.length) bad('need', null);
        var w = $('#f-when');
        if (!w.value) bad('when', w);
        else hideErr('when', w);
      }

      if (step === 3) {
        var c = $('#f-company');
        if (!c.value.trim() || c.value.trim().length < 2) bad('company', c);
        else hideErr('company', c);

        var cn = $('#f-cnpj');
        if (cn.value.replace(/\D/g, '').length !== 14) bad('cnpj', cn);
        else hideErr('cnpj', cn);

        var cp = $('#f-cep');
        if (cp.value.replace(/\D/g, '').length !== 8) bad('cep', cp);
        else hideErr('cep', cp);

        var ct = $('#f-city');
        if (!ct.value.trim()) bad('city', ct);
        else hideErr('city', ct);
      }

      if (step === 4) {
        var n = $('#f-name');
        if (!n.value.trim() || n.value.trim().split(' ').length < 2)
          bad('name', n, 'Informe nome e sobrenome.');
        else hideErr('name', n);

        var rl = $('#f-role');
        if (!rl.value) bad('role', rl);
        else hideErr('role', rl);

        var em = $('#f-email');
        if (!validEmail(em.value)) bad('email', em, 'Use um e-mail válido.');
        else hideErr('email', em);

        var ph = $('#f-phone');
        if (ph.value.replace(/\D/g, '').length < 10) bad('phone', ph);
        else hideErr('phone', ph);

        if (!picked.next) bad('next', null);

        var lg = $('#f-lgpd');
        if (!lg.checked) bad('lgpd', null);
        else hideErr('lgpd', null);
      }

      if (!ok && first && first.focus) first.focus();
      return ok;
    }

    /* --- navegação --- */
    var fill = $('#p-fill');
    var pStep = $('#p-step');
    var pPct = $('#p-pct');
    var pRole = $('#p-role');
    var back = $('#btn-back');
    var next = $('#btn-next');

    function paint() {
      steps.forEach(function (s) {
        s.setAttribute(
          'data-current',
          String(+s.getAttribute('data-step') === current)
        );
      });
      var pct = Math.round((current / total) * 100);
      fill.style.width = pct + '%';
      pPct.textContent = pct + '%';
      pStep.textContent =
        'Etapa ' + current + ' de ' + total + ' — ' + titles[current - 1];
      pRole.setAttribute('aria-valuenow', String(pct));
      back.hidden = current === 1;
      next.textContent =
        current === total ? 'Enviar e receber cotação' : 'Continuar';
      if (current === total) buildRecap();
    }

    // mantém a calculadora e o formulário falando o mesmo número
    function syncCalc() {
      var p = +($('#f-people').value || 0);
      if (p > 0) CALC.people = p;
      var sl = $('#c-people');
      if (sl) sl.value = Math.min(+sl.max, Math.max(+sl.min, CALC.people));
      if (picked.shift === '3 turnos / 24h') CALC.shifts = 3;
      else if (picked.shift === '2 turnos') CALC.shifts = 2;
      else if (picked.shift === '1 turno') CALC.shifts = 1;
      renderCalc();
    }

    function buildRecap() {
      syncCalc();
      var r = compute();
      var rows = [
        ['Colaboradores', $('#f-people').value || '—'],
        ['Segmento', picked.seg || '—'],
        ['Turnos', picked.shift || '—'],
        ['Cenário atual', picked.now || '—'],
        ['Plano indicado', r.plan.name],
        ['Volume estimado', num(r.monthly) + ' doses/mês']
      ];
      $('#recap').innerHTML = rows
        .map(function (x) {
          return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>';
        })
        .join('');
    }

    next.addEventListener('click', function () {
      if (!validate(current)) return;
      if (current < total) {
        current++;
        paint();
        var top = $('#orcamento').getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: top, behavior: 'smooth' });
      } else {
        submit();
      }
    });

    back.addEventListener('click', function () {
      if (current > 1) {
        current--;
        paint();
      }
    });

    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        next.click();
      }
    });

    /* --- envio --- */
    function leadScore(r) {
      var s = 0;
      var people = +($('#f-people').value || 0);
      if (people >= 300) s += 25;
      else if (people >= 100) s += 20;
      else if (people >= 26) s += 13;
      else s += 5;

      var u = $('#f-units').value;
      if (u === '10+') s += 12;
      else if (u === '4-10') s += 9;
      else if (u === '2-3') s += 5;

      if (picked.shift === '3 turnos / 24h') s += 10;
      else if (picked.shift === '2 turnos') s += 6;

      var when = $('#f-when').value;
      if (when === 'Imediato') s += 20;
      else if (when === 'Até 30 dias') s += 15;
      else if (when === '1 a 3 meses') s += 8;
      else s += 1;

      var vc = $('#f-contract') ? $('#f-contract').value : '';
      if (vc === 'Já vencido' || vc === 'Até 30 dias') s += 8;

      if (picked.now === 'Cápsulas') s += 8;
      else if (picked.now === 'Coado / garrafa térmica') s += 6;
      else if (picked.now === 'Locação com outro fornecedor') s += 7;

      var role = $('#f-role').value;
      if (role === 'Diretoria / Sócio') s += 10;
      else if (role === 'Facilities / Administrativo') s += 8;
      else if (role === 'Compras / Suprimentos') s += 7;
      else if (role === 'RH / Gente e Gestão') s += 5;

      if (picked.next === 'Degustação na empresa') s += 8;
      else if (picked.next === 'Visita técnica de levantamento') s += 8;
      else if (picked.next === 'Ligação de um consultor') s += 5;

      if (isCorporate($('#f-email').value)) s += 5;

      return Math.min(100, s);
    }

    function band(s) {
      if (s >= 75) return { faixa: 'Prioritário', sla: '15 minutos' };
      if (s >= 55) return { faixa: 'Quente', sla: '1 hora' };
      if (s >= 35) return { faixa: 'Morno', sla: '4 horas' };
      return { faixa: 'Frio', sla: '24 horas' };
    }

    var abertoEm = Date.now();

    /* aquece o reCAPTCHA no primeiro toque do formulário, para não
       existir espera no momento do envio */
    var aquecido = false;
    form.addEventListener(
      'focusin',
      function () {
        if (aquecido) return;
        aquecido = true;
        carregarRecaptcha().catch(function () {});
      },
      true
    );

    function submit() {
      /* guarda anti-robô: honeypot preenchido ou formulário concluído em
         menos de 4 segundos indica automação. Encerra em silêncio. */
      var honey = $('#f-honey');
      if ((honey && honey.value) || Date.now() - abertoEm < 4000) {
        if (window.console) console.warn('[RGS] envio bloqueado (suspeita de robô)');
        return;
      }
      syncCalc();
      var r = compute();
      var s = leadScore(r);
      var b = band(s);
      $('#f-score').value = String(s);

      var payload = {
        origem: 'Formulário de orçamento',
        empresa: $('#f-company').value.trim(),
        cnpj: $('#f-cnpj').value,
        cep: $('#f-cep').value,
        cidade: $('#f-city').value.trim(),
        endereco: $('#f-address').value.trim(),
        nome: $('#f-name').value.trim(),
        cargo: $('#f-role').value,
        email: $('#f-email').value.trim(),
        whatsapp: $('#f-phone').value,
        colaboradores: +$('#f-people').value,
        unidades: $('#f-units').value,
        segmento: picked.seg,
        turnos: picked.shift,
        cenario_atual: picked.now,
        vencimento_contrato: $('#f-contract') ? $('#f-contract').value : '',
        necessidades: picked.need,
        menu: $('#f-drinks').value,
        prazo: $('#f-when').value,
        proximo_passo: picked.next,
        observacoes: $('#f-notes').value.trim(),
        plano_sugerido: r.plan.name,
        doses_mes: Math.round(r.monthly),
        kg_mes: Math.round(r.kg),
        lead_score: s,
        faixa: b.faixa,
        sla_resposta: b.sla,
        utm_source: $('#f-utm-source').value,
        utm_medium: $('#f-utm-medium').value,
        utm_campaign: $('#f-utm-campaign').value,
        gclid: $('#f-gclid').value,
        pagina_origem: $('#f-page').value
      };

      if (window.console) console.log('[RGS] lead orçamento', payload);

      var assunto =
        '[Site] Orçamento ' +
        payload.plano_sugerido +
        ' — ' +
        payload.empresa +
        ' (' +
        payload.colaboradores +
        ' colaboradores, ' +
        payload.faixa +
        ')';

      var rotuloOriginal = next.textContent;
      next.textContent = 'Enviando...';
      next.disabled = true;

      var erroBox = $('#submit-error');
      if (erroBox) erroBox.setAttribute('data-show', 'false');

      enviarLead(payload, assunto)
        .then(function (res) {
          mostrarSucesso(payload, res.confirmacao.via === 'emailjs');
        })
        .catch(function (err) {
          if (window.console) console.warn('[RGS] falha no envio', err);
          next.textContent = rotuloOriginal;
          next.disabled = false;
          if (erroBox) {
            var link = $('#submit-error-mail');
            if (link) link.href = mailtoFallback(payload, assunto);
            var zap = $('#submit-error-wa');
            if (zap) {
              zap.href =
                'https://wa.me/' +
                LEAD.copiaWhatsapp +
                '?text=' +
                encodeURIComponent(
                  'Olá! Sou ' +
                    payload.nome +
                    ' da ' +
                    payload.empresa +
                    '. Tentei enviar um orçamento pelo site e não completou. ' +
                    payload.colaboradores +
                    ' colaboradores em ' +
                    payload.cidade +
                    '.'
                );
            }
            erroBox.setAttribute('data-show', 'true');
            erroBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
    }

    function mostrarSucesso(payload, confirmou) {
      setTimeout(function () {
        form.style.display = 'none';
        $('#progress').style.display = 'none';
        var ok = $('#success');
        ok.setAttribute('data-show', 'true');

        var nome = payload.nome.split(' ')[0];
        $('#success-title').textContent = nome
          ? nome + ', solicitação recebida.'
          : 'Solicitação recebida.';

        var msg =
          'Registramos ' +
          num(payload.colaboradores) +
          ' colaboradores e volume estimado de ' +
          num(payload.doses_mes) +
          ' doses por mês — perfil de plano ' +
          payload.plano_sugerido +
          '. ';
        if (payload.proximo_passo === 'Degustação na empresa') {
          msg +=
            'Um consultor entra em contato para confirmar a data da degustação na sua empresa.';
        } else if (payload.proximo_passo === 'Visita técnica de levantamento') {
          msg +=
            'Nossa equipe técnica entra em contato para agendar o levantamento no local.';
        } else if (payload.proximo_passo === 'Ligação de um consultor') {
          msg += 'Um consultor liga para o número informado ainda hoje.';
        } else {
          msg += 'A cotação chega no seu e-mail em até 2 horas úteis.';
        }
        if (confirmou) {
          msg +=
            ' Já enviamos uma confirmação para ' + payload.email + '.';
        }
        $('#success-copy').textContent = msg;

        var wa = $('#success-wa');
        if (wa) {
          wa.href =
            'https://wa.me/5519974061692?text=' +
            encodeURIComponent(
              'Olá! Sou ' +
                payload.nome +
                ' da ' +
                payload.empresa +
                '. Acabei de solicitar orçamento no site (' +
                num(payload.colaboradores) +
                ' colaboradores, ' +
                payload.cidade +
                ').'
            );
        }

        window.scrollTo({
          top: $('#orcamento').getBoundingClientRect().top + window.scrollY - 90,
          behavior: 'smooth'
        });
      }, 700);
    }

    /* --- tracking oculto --- */
    (function tracking() {
      var q = new URLSearchParams(window.location.search);
      $('#f-utm-source').value = q.get('utm_source') || 'direto';
      $('#f-utm-medium').value = q.get('utm_medium') || '';
      $('#f-utm-campaign').value = q.get('utm_campaign') || '';
      $('#f-gclid').value = q.get('gclid') || '';
      $('#f-page').value = window.location.pathname || '/';
    })();

    paint();
  })();

  /* ---------- ano no rodapé ---------- */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
