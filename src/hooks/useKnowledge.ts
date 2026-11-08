import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CaseStudy, Domain, Method, Relation, Source } from '@shared/types';

/** 知识库数据 hooks —— 统一处理加载、错误与离线缓存标记 */

export function useMethods() {
  return useQuery({
    queryKey: ['methods'],
    queryFn: async () => {
      const res = await api.listMethods();
      return { methods: res.data.methods, stale: res.stale, fetchedAt: res.fetchedAt };
    },
  });
}

export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const res = await api.listDomains();
      return { domains: res.data.domains, stale: res.stale };
    },
  });
}

export function useRelations() {
  return useQuery({
    queryKey: ['relations'],
    queryFn: async () => {
      const res = await api.listRelations();
      return { relations: res.data.relations, stale: res.stale };
    },
  });
}

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const res = await api.listSources();
      return { sources: res.data.sources, stale: res.stale };
    },
  });
}

export function useCases() {
  return useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const res = await api.listCases();
      return { cases: res.data.cases, stale: res.stale };
    },
  });
}

export function useMethod(id: string | undefined) {
  return useQuery({
    queryKey: ['method', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.getMethod(id!);
      return { method: res.data.method, stale: res.stale };
    },
  });
}

export function buildNameMap(methods: Method[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of methods) map.set(m.id, m.name);
  return map;
}

export function buildDomainMap(domains: Domain[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of domains) map.set(d.id, d.name);
  return map;
}

export interface GraphNode {
  id: string;
  name: string;
  domainIds: string[];
  type: string;
}

export function toGraphNodes(methods: Method[]): GraphNode[] {
  return methods.map((m) => ({
    id: m.id,
    name: m.name,
    domainIds: m.domainIds,
    type: m.type,
  }));
}

export type { CaseStudy, Domain, Method, Relation, Source };
