'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

type Resultado = { id: string; name: string; slug: string; typeKey: string };

const ESPERA_MS = 120;

export function Paleta({ campanha }: { campanha: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() !== 'k' || !(evento.metaKey || evento.ctrlKey)) return;
      evento.preventDefault();
      setAberta((estava) => !estava);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  useEffect(() => {
    const termo = consulta.trim();
    // Sem termo não há o que buscar, e limpar a lista aqui seria setState dentro
    // de efeito — a lista vazia é derivada na renderização, logo abaixo.
    if (!termo) return;
    // Debounce curto e cancelamento por AbortController: digitar rápido não pode
    // deixar uma resposta velha sobrescrever a nova.
    const controle = new AbortController();
    const temporizador = setTimeout(async () => {
      try {
        const resposta = await fetch(
          `/api/busca?c=${encodeURIComponent(campanha)}&q=${encodeURIComponent(termo)}`,
          { signal: controle.signal },
        );
        if (resposta.ok) setResultados((await resposta.json()).resultados);
      } catch {
        // requisição cancelada ou rede caiu: a paleta não é lugar de dar erro
      }
    }, ESPERA_MS);

    return () => {
      clearTimeout(temporizador);
      controle.abort();
    };
  }, [consulta, campanha]);

  // Com a busca apagada não se mostra o resultado da busca anterior.
  const visiveis = consulta.trim() ? resultados : [];

  function abrir(resultado: Resultado) {
    setAberta(false);
    setConsulta('');
    router.push(`/c/${campanha}/e/${resultado.slug}`);
  }

  return (
    <CommandDialog
      open={aberta}
      onOpenChange={setAberta}
      title="Buscar"
      description="Busque uma página desta campanha pelo nome."
    >
      {/* O filtro é do Postgres (trigram); o cmdk não pode filtrar de novo por cima. */}
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Buscar na campanha…"
          value={consulta}
          onValueChange={setConsulta}
        />
        <CommandList>
          <CommandEmpty>
            {consulta.trim() ? 'Nada com esse nome.' : 'Digite para buscar.'}
          </CommandEmpty>
          {visiveis.map((resultado) => (
            <CommandItem
              key={resultado.id}
              value={resultado.id}
              onSelect={() => abrir(resultado)}
              className="flex items-baseline gap-2"
            >
              <span>{resultado.name}</span>
              <span className="text-muted-foreground ml-auto text-xs">{resultado.typeKey}</span>
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
