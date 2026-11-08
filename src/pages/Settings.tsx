import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings as SettingsIcon, Download, Upload, KeyRound, Shield, Server } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Label,
  LoadingBlock,
  Badge,
  Alert,
} from '../components/ui';
import { api, getToken, setToken } from '../lib/api';
import { useAppStore, type ThemeMode } from '../store/useAppStore';
import { formatCost, formatTokens } from '../lib/format';
import { MODEL_REGISTRY } from '@shared/providers/ai/types';

export default function Settings() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const showToast = useAppStore((s) => s.showToast);
  const [token, setTokenState] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.health()).data,
    retry: false,
  });

  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: async () => (await api.getConfig()).data,
    retry: false,
  });

  const saveToken = () => {
    setToken(token.trim());
    showToast('访问令牌已保存到本地', 'success');
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const res = await api.exportBundle();
      const blob = new Blob([JSON.stringify(res.data.bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `methodology-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('导出完成', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        const text = await file.text();
        const bundle = JSON.parse(text) as unknown;
        const res = await api.importBundle(bundle);
        showToast(`导入完成，共 ${res.data.imported} 条`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : '导入失败', 'error');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const health = healthQuery.data ?? null;
  const config = configQuery.data;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">设置</h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          访问控制、数据导入导出与界面偏好
        </p>
      </header>

      {/* 连接状态 */}
      <Card>
        <CardHeader
          title="后端连接"
          description="Worker 与数据仓状态"
          action={
            <Server className="h-4 w-4 text-slate-400" />
          }
        />
        <CardBody>
          {healthQuery.isLoading ? (
            <LoadingBlock label="检测中" />
          ) : healthQuery.isError ? (
            <Alert kind="danger" title="无法连接后端">
              {healthQuery.error instanceof Error ? healthQuery.error.message : '未知错误'}
              。请确认 Worker 已部署，或在下方填写访问令牌。
            </Alert>
          ) : health ? (
            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">状态</dt>
                <dd className="flex-1">
                  <Badge tone="success">正常</Badge>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">当前模型</dt>
                <dd className="flex-1 text-slate-700 dark:text-slate-300">
                  {health.model ?? '未配置'}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">搜索源</dt>
                <dd className="flex-1 text-slate-700 dark:text-slate-300">
                  {health.searchProvider}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-400">数据仓</dt>
                <dd className="flex-1 text-slate-700 dark:text-slate-300">
                  {health.dataRepo ?? '未配置'}
                </dd>
              </div>
            </dl>
          ) : null}
        </CardBody>
      </Card>

      {/* 访问令牌 */}
      <Card>
        <CardHeader
          title="访问令牌"
          description="调用后端 API 的 Bearer Token"
          action={<KeyRound className="h-4 w-4 text-slate-400" />}
        />
        <CardBody className="space-y-3">
          <Alert kind="info" title="密钥安全">
            令牌只保存在本机浏览器，不会上传到任何服务器，也不会写入仓库。AI 模型密钥与
            GitHub Token 全部存放在服务端 Worker 的环境变量中，前端代码与公开仓库中不存在任何密钥。
          </Alert>
          <div>
            <Label>Worker 访问令牌</Label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setTokenState(e.target.value)}
              placeholder="粘贴 Worker 的 APP_TOKEN"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveToken}>
              保存令牌
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setToken('');
                setTokenState('');
                showToast('令牌已清除');
              }}
            >
              清除
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 模型配置 */}
      <Card>
        <CardHeader
          title="可用模型"
          description="不同任务自动路由到合适的模型"
          action={<Shield className="h-4 w-4 text-slate-400" />}
        />
        <CardBody>
          {configQuery.isError ? (
            <p className="text-xs text-slate-400">无法读取配置，请先配置访问令牌</p>
          ) : config ? (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
                {Object.entries(config.taskRouting).map(([task, modelId]) => (
                  <span
                    key={task}
                    className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {task} → {modelId}
                  </span>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <p className="text-[11px] text-slate-400">单次任务费用上限</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCost(config.costLimitPerTask) || '未设置'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <p className="text-[11px] text-slate-400">每周费用上限</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCost(config.costLimitPerWeek) || '未设置'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <p className="text-[11px] text-slate-400">联网搜索</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {config.webSearchEnabled ? '已启用' : '已关闭'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <p className="text-[11px] text-slate-400">每周研究目标数</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {config.weeklyTargetCount || '未设置'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">加载中</p>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
              查看模型注册表
            </summary>
            <ul className="mt-2 space-y-1">
              {MODEL_REGISTRY.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] dark:border-slate-800"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">{m.label}</span>
                  <Badge tone="muted">{m.provider}</Badge>
                  {m.supportsWebSearch ? <Badge tone="info">联网</Badge> : null}
                  <span className="ml-auto text-slate-400">
                    {formatTokens(m.contextWindow)} 上下文
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </CardBody>
      </Card>

      {/* 导入导出 */}
      <Card>
        <CardHeader
          title="数据导入导出"
          description="完整备份或迁移知识库"
          action={<SettingsIcon className="h-4 w-4 text-slate-400" />}
        />
        <CardBody className="space-y-2">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            导出内容包含方法论档案、领域、关系、来源、案例、实践记录与学习数据。
            备份同样会保留在数据仓的 backups 目录中。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={doExport}
              icon={<Download className="h-3.5 w-3.5" />}
            >
              导出 JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={busy}
              onClick={doImport}
              icon={<Upload className="h-3.5 w-3.5" />}
            >
              导入 JSON
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 外观 */}
      <Card>
        <CardHeader title="外观" description="主题与显示偏好" />
        <CardBody>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['light', '浅色'],
                ['dark', '深色'],
                ['system', '跟随系统'],
              ] as Array<[ThemeMode, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={
                  theme === value
                    ? 'rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-slate-700 dark:text-slate-100'
                    : 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
