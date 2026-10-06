// dsh-gauntlet 设置页（浏览器半边）。手写成 dsh 客户端模块格式，不需要构建步骤。
//
// 出现在 Web 侧栏「插件」→「已安装」→ dsh-gauntlet 的页面上（plugins.bundle.config slot），
// 编辑本插件行 `gauntlet` 的 volatile 配置 stages：
// 每个阶段子 agent 用哪个 provider / model / reasoningEffort。留空 = 继承会话默认模型。
// 模型列表来自 remote.session.modelCatalog()（真实可用的路由）；已保存但目录里没有的路由单独列出。
// 写入用 configForms 的修订号做栅栏，冲突时提示重新加载，不覆盖更新的值。
//
// 只用宿主共享模块：react、@deepseek-ai/dsh-client-ui-primitives、@deepseek-ai/dsh-client-store。
// 阶段 key 必须与 lib/stages.js 一致。
window.__ModuleLoader__.load({
  id: 'dsh-gauntlet',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    const clientStore = require('@deepseek-ai/dsh-client-store');
    const h = React.createElement;

    const PACKAGE = 'dsh-gauntlet';
    const NS = 'settings.gauntlet';
    const CONFIG_NS = 'gauntlet'; // = cordis.patch.yml 里插件行的 id
    const STAGE_KEYS = ['surveyor', 'specifier', 'coder', 'cleaner', 'hardener', 'qa', 'reporter'];

    // ---------------------------------------------------------------- 文案
    const zh = {
      title: 'Gauntlet 小队',
      description: '为 7 个阶段子 agent 分别选择模型。',
      intro: '每个阶段由一个独立的子 agent 完成。常见做法：编码、加固用更强的模型，摸底、规格用更快的模型。',
      colStage: '阶段',
      colModel: '模型',
      colEffort: '推理强度',
      inherit: '继承会话默认',
      effortDefault: '模型默认',
      effortDefaultNamed: '模型默认（{name}）',
      effortNone: '—',
      unavailableGroup: '已保存但当前不可用',
      unavailableHint: '这个模型已不在可用列表里，调用该阶段会失败。请换一个，或恢复为继承会话默认。',
      catalogLoading: '正在读取可用模型…',
      catalogError: '读取可用模型失败。',
      catalogPartial: '部分 provider 读取失败，列表可能不完整。',
      retry: '重试',
      resetAll: '全部恢复为继承会话默认',
      footnote: '改动只影响之后新建的 Gauntlet 会话；正在运行的会话保持原来的模型。Leader 使用会话本身的模型。',
      conflict: '配置在别处被修改过。放弃这里的改动以加载最新值。',
      unavailable: '插件没有加载，暂时无法配置。',
      readOnly: '这个部署的设置是只读的。',
      saveFailed: '部署没有接受这些值，已保留以便修改。',
      save: '保存',
      saving: '保存中…',
      stage_surveyor: '⓪ 摸底 Surveyor',
      stage_surveyor_desc: '摸清仓库、装好工具、写项目档案',
      stage_specifier: '① 规格 Specifier',
      stage_specifier_desc: '需求 → 验收场景与约束',
      stage_coder: '② 编码 Coder',
      stage_coder_desc: 'TDD 实现，全部场景通过',
      stage_cleaner: '③ 清理 Cleaner',
      stage_cleaner_desc: '不改行为，重构到质量阈值',
      stage_hardener: '④ 加固 Hardener',
      stage_hardener_desc: '变异测试，补测试杀死变异体',
      stage_qa: '⑤ QA',
      stage_qa_desc: '在真实产物上逐条验证',
      stage_reporter: '⑥ 证据包 Reporter',
      stage_reporter_desc: '复验、录演示、生成证据包',
    };
    const en = {
      title: 'Gauntlet squad',
      description: 'Choose a model for each of the 7 stage agents.',
      intro: 'Each stage runs in its own subagent. A common setup: stronger models for coding and hardening, faster ones for survey and spec.',
      colStage: 'Stage',
      colModel: 'Model',
      colEffort: 'Reasoning effort',
      inherit: 'Inherit session default',
      effortDefault: 'Model default',
      effortDefaultNamed: 'Model default ({name})',
      effortNone: '—',
      unavailableGroup: 'Saved but currently unavailable',
      unavailableHint: 'This model is no longer offered; the stage will fail when called. Pick another or inherit the session default.',
      catalogLoading: 'Loading available models…',
      catalogError: 'Could not load the available models.',
      catalogPartial: 'Some providers failed to load; the list may be incomplete.',
      retry: 'Retry',
      resetAll: 'Reset all to session default',
      footnote: 'Changes apply to new Gauntlet sessions only; running sessions keep their models. The Leader uses the session model.',
      conflict: 'The settings changed elsewhere. Discard your edits to load the latest values.',
      unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
      readOnly: 'This deployment stores settings read-only.',
      saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
      save: 'Save',
      saving: 'Saving…',
      stage_surveyor: '⓪ Surveyor',
      stage_surveyor_desc: 'Map the repo, install tools, write the profile',
      stage_specifier: '① Specifier',
      stage_specifier_desc: 'Requirement → acceptance scenarios and constraints',
      stage_coder: '② Coder',
      stage_coder_desc: 'TDD until every scenario passes',
      stage_cleaner: '③ Cleaner',
      stage_cleaner_desc: 'Refactor to the quality thresholds, same behavior',
      stage_hardener: '④ Hardener',
      stage_hardener_desc: 'Mutation testing, kill every mutant',
      stage_qa: '⑤ QA',
      stage_qa_desc: 'Verify each constraint on the real build',
      stage_reporter: '⑥ Reporter',
      stage_reporter_desc: 'Re-verify, record demos, build the evidence pack',
    };

    // ---------------------------------------------------------------- 样式（宿主主题 token，自动适配明暗）
    const css = `
.gx-intro{margin:0 0 4px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6}
.gx-table{display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(180px,1.6fr) minmax(130px,1fr);border-top:.5px solid var(--dsw-alias-border-l2);margin-top:12px}
.gx-head{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500;padding:10px 12px 8px 0}
.gx-cell{padding:12px 12px 12px 0;border-top:.5px solid var(--dsw-alias-border-l2);min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
.gx-stage{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.4}
.gx-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.4}
.gx-select{appearance:none;-webkit-appearance:none;width:100%;min-width:0;height:32px;padding:0 28px 0 10px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%23888' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-overflow:ellipsis;cursor:pointer}
.gx-select:hover:not(:disabled){background-color:var(--dsw-alias-interactive-bg-hover)}
.gx-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.gx-select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default;opacity:.7}
.gx-select[data-invalid]{border-color:var(--dsw-alias-state-error-primary)}
.gx-select option,.gx-select optgroup{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.gx-warn{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.4}
.gx-notice{margin-top:10px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gx-notice[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.gx-link{background:none;border:0;padding:0;font:inherit;color:var(--dsw-alias-brand-primary);cursor:pointer}
.gx-link:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.gx-foot{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-top:14px}
.gx-footnote{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;flex:1 1 260px}
@media (max-width:640px){
  .gx-table{grid-template-columns:1fr}
  .gx-head{display:none}
  .gx-cell{border-top:0;padding:4px 0}
  .gx-cell[data-col=stage]{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:14px}
  .gx-cell[data-col=effort]{padding-bottom:12px}
}`;
    const tagId = 'dsh-gauntlet/settings.css';
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-gauntlet';
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    // ---------------------------------------------------------------- 数据
    const routeKey = (r) => (r && r.provider && r.model ? r.provider + '\u0000' + r.model : '');

    /** 只保留认识的阶段和完整的路由。 */
    function normalizeStages(value) {
      const out = {};
      for (const key of STAGE_KEYS) {
        const r = value && value[key];
        if (r && r.provider && r.model) out[key] = { provider: r.provider, model: r.model, ...(r.reasoningEffort ? { reasoningEffort: r.reasoningEffort } : {}) };
      }
      return out;
    }

    function sameStages(a, b) {
      for (const key of STAGE_KEYS) {
        const x = a[key], y = b[key];
        if (routeKey(x) !== routeKey(y)) return false;
        if ((x && x.reasoningEffort || '') !== (y && y.reasoningEffort || '')) return false;
      }
      return true;
    }

    /** 绑定 `gauntlet` 配置表单与模型目录的暂存控制器（与「子智能体」页同一模式）。 */
    class GauntletCardController {
      constructor(scope, ctx) {
        this.scope = scope;
        this.ctx = ctx;
        this.groups = [];
        this.catalogStatus = 'idle';
        this.catalogPartial = false;
        this.draft = undefined;
        this.draftRevision = undefined;
        this.saving = false;
        this.failed = false;
        this.conflicted = false;
        this.disposed = false;
        this.saveGeneration = 0;
        this.catalogGeneration = 0;
        this.store = clientStore.createSnapshotStore(this.projection());
        this.unsubscribe = scope.subscribe(() => {
          if (!this.saving && this.draft !== undefined && this.scope.getSnapshot().revision !== this.draftRevision) {
            if (sameStages(this.current(), this.draft)) this.clearDraft();
            else this.conflicted = true;
          }
          this.publish();
        });
        this.loadCatalog();
      }

      dispose() {
        this.disposed = true;
        this.saveGeneration += 1;
        this.catalogGeneration += 1;
        this.unsubscribe();
      }

      inject() {
        return {
          hooks: { gauntletCard: this.store },
          setModel: (stage, key) => this.setModel(stage, key),
          setEffort: (stage, effort) => this.setEffort(stage, effort),
          resetAll: () => this.resetAll(),
          retryCatalog: () => this.refreshCatalog(),
          save: () => this.save(),
          discard: () => this.discard(),
        };
      }

      current() {
        const snapshot = this.scope.getSnapshot();
        return normalizeStages(snapshot.value && snapshot.value.stages);
      }

      desired() {
        return this.draft !== undefined ? this.draft : this.current();
      }

      editable() {
        const snapshot = this.scope.getSnapshot();
        return !this.disposed && snapshot.status === 'ready' && snapshot.writable && !this.saving;
      }

      beginDraft() {
        if (this.draft === undefined) {
          this.draft = { ...this.current() };
          this.draftRevision = this.scope.getSnapshot().revision;
        }
        return this.draft;
      }

      findModel(provider, model) {
        const group = this.groups.find((g) => g.id === provider);
        return group && group.models.find((m) => m.id === model);
      }

      setModel(stage, key) {
        if (!this.editable() || !STAGE_KEYS.includes(stage)) return;
        const draft = this.beginDraft();
        if (!key) delete draft[stage];
        else {
          const [provider, model] = key.split('\u0000');
          const prev = draft[stage];
          const info = this.findModel(provider, model);
          const efforts = (info && info.reasoning && info.reasoning.efforts) || [];
          // 换模型时只保留新模型也支持的推理强度，否则回到模型默认。
          const keep = prev && prev.reasoningEffort && efforts.some((e) => e.id === prev.reasoningEffort) ? prev.reasoningEffort : undefined;
          draft[stage] = { provider, model, ...(keep ? { reasoningEffort: keep } : {}) };
        }
        this.failed = false;
        this.publish();
      }

      setEffort(stage, effort) {
        if (!this.editable()) return;
        const draft = this.beginDraft();
        const route = draft[stage];
        if (!route) return;
        draft[stage] = effort ? { provider: route.provider, model: route.model, reasoningEffort: effort } : { provider: route.provider, model: route.model };
        this.failed = false;
        this.publish();
      }

      resetAll() {
        if (!this.editable()) return;
        this.beginDraft();
        this.draft = {};
        this.failed = false;
        this.publish();
      }

      clearDraft() {
        this.draft = undefined;
        this.draftRevision = undefined;
        this.failed = false;
        this.conflicted = false;
      }

      discard() {
        if (this.saving) return;
        this.clearDraft();
        this.publish();
      }

      async save() {
        const snapshot = this.scope.getSnapshot();
        const desired = this.desired();
        if (!this.editable() || this.draft === undefined || sameStages(this.current(), desired)) return;
        if (snapshot.revision !== this.draftRevision) {
          this.conflicted = true;
          this.publish();
          return;
        }
        const generation = this.saveGeneration;
        this.saving = true;
        this.failed = false;
        this.publish();
        try {
          await this.scope.mutate([{ op: 'set', path: ['stages'], value: desired }], this.draftRevision);
        } catch {
          // 结果以下面的"是否落地"为准
        }
        if (generation !== this.saveGeneration) return;
        const landed = sameStages(this.current(), desired);
        this.saving = false;
        this.failed = !landed;
        if (landed) this.clearDraft();
        this.publish();
      }

      refreshCatalog() {
        if (this.disposed) return;
        this.catalogGeneration += 1;
        this.catalogStatus = 'idle';
        this.loadCatalog();
      }

      resetConnection() {
        if (this.disposed) return;
        this.saveGeneration += 1;
        this.saving = false;
        this.clearDraft();
        this.groups = [];
        this.refreshCatalog();
      }

      async loadCatalog() {
        if (this.disposed || this.catalogStatus === 'loading') return;
        const generation = this.catalogGeneration;
        this.catalogStatus = 'loading';
        this.catalogPartial = false;
        this.publish();
        let response;
        try {
          response = await this.ctx.remote.session.modelCatalog();
        } catch {
          response = { ok: false };
        }
        if (generation !== this.catalogGeneration || this.disposed) return;
        if (response && response.ok) {
          this.groups = response.value.groups || [];
          this.catalogPartial = (response.value.failures || []).length > 0;
          this.catalogStatus = 'ready';
        } else this.catalogStatus = 'error';
        this.publish();
      }

      /** 每个阶段一行：当前选择、它在目录里的信息、可选推理强度。 */
      rows(desired) {
        return STAGE_KEYS.map((stage) => {
          const route = desired[stage];
          if (!route) return { stage, key: '', route: undefined, known: true, efforts: [], defaultEffort: undefined };
          const info = this.findModel(route.provider, route.model);
          return {
            stage,
            key: routeKey(route),
            route,
            // 目录还没读到时不判定为"不可用"，避免闪一下警告
            known: info !== undefined || this.catalogStatus !== 'ready',
            efforts: (info && info.reasoning && info.reasoning.efforts) || [],
            defaultEffort: info && info.reasoning && info.reasoning.defaultEffort,
          };
        });
      }

      /** 目录里没有、但已保存或暂存着的路由：单独成组，仍可被选中保留或换掉。 */
      orphans(desired) {
        if (this.catalogStatus !== 'ready') return [];
        const seen = new Map();
        for (const r of [...Object.values(this.current()), ...Object.values(desired)]) {
          if (!this.findModel(r.provider, r.model)) seen.set(routeKey(r), { provider: r.provider, model: r.model });
        }
        return [...seen.entries()].map(([key, r]) => ({ key, label: r.provider + ' / ' + r.model }));
      }

      projection() {
        const snapshot = this.scope.getSnapshot();
        const desired = this.desired();
        return {
          available: snapshot.status === 'ready',
          writable: !!snapshot.writable,
          dirty: this.draft !== undefined && !sameStages(this.current(), desired),
          invalid: this.conflicted,
          saving: this.saving,
          failed: this.failed,
          conflicted: this.conflicted,
          groups: this.groups,
          orphans: this.orphans(desired),
          rows: this.rows(desired),
          anySet: Object.keys(desired).length > 0,
          catalogStatus: this.catalogStatus,
          catalogPartial: this.catalogPartial,
        };
      }

      publish() {
        this.store.set(this.projection());
      }
    }

    // ---------------------------------------------------------------- 视图
    function ModelSelect({ t, row, state, disabled, onChange, labelId }) {
      const options = [h('option', { key: '', value: '' }, t('inherit'))];
      for (const group of state.groups) {
        options.push(h('optgroup', { key: 'g:' + group.id, label: group.name || group.id },
          group.models.map((m) => h('option', { key: group.id + '/' + m.id, value: group.id + '\u0000' + m.id }, m.name || m.id))));
      }
      if (state.orphans.length) {
        options.push(h('optgroup', { key: 'orphans', label: t('unavailableGroup') },
          state.orphans.map((o) => h('option', { key: 'o:' + o.key, value: o.key }, o.label))));
      }
      // 目录未就绪时，已保存的路由也要能显示出来
      if (row.key && state.catalogStatus !== 'ready') {
        options.push(h('option', { key: 'cur', value: row.key }, row.route.provider + ' / ' + row.route.model));
      }
      return h('select', {
        className: 'gx-select',
        value: row.key,
        disabled,
        'aria-labelledby': labelId,
        'data-invalid': row.known ? undefined : '',
        onChange: (e) => onChange(row.stage, e.target.value),
      }, options);
    }

    function EffortSelect({ t, row, disabled, onChange, labelId }) {
      if (!row.route || row.efforts.length === 0) {
        return h('select', { className: 'gx-select', disabled: true, value: '', 'aria-labelledby': labelId },
          h('option', { value: '' }, row.route ? t('effortDefault') : t('effortNone')));
      }
      const def = row.efforts.find((e) => e.id === row.defaultEffort);
      return h('select', {
        className: 'gx-select',
        value: row.route.reasoningEffort || '',
        disabled,
        'aria-labelledby': labelId,
        onChange: (e) => onChange(row.stage, e.target.value),
      }, [
        h('option', { key: '', value: '' }, def ? t('effortDefaultNamed').replace('{name}', def.name || def.id) : t('effortDefault')),
        ...row.efforts.map((e) => h('option', { key: e.id, value: e.id, title: e.description }, e.name || e.id)),
      ]);
    }

    function CatalogNotice({ t, state, retry }) {
      if (state.catalogStatus === 'loading') return h('div', { className: 'gx-notice', role: 'status' }, t('catalogLoading'));
      if (state.catalogStatus === 'error') {
        return h('div', { className: 'gx-notice', 'data-tone': 'error', role: 'alert' },
          t('catalogError'), h('button', { type: 'button', className: 'gx-link', onClick: retry }, t('retry')));
      }
      if (state.catalogPartial) {
        return h('div', { className: 'gx-notice' },
          t('catalogPartial'), h('button', { type: 'button', className: 'gx-link', onClick: retry }, t('retry')));
      }
      return null;
    }

    function GauntletCard(props) {
      const { t } = props;
      const state = props.useGauntletCard((s) => s);
      const baseId = React.useId();
      if (props.view === 'summary') return t('description');
      const disabled = !state.available || !state.writable || state.saving;
      const head = (text, col) => h('div', { key: 'h-' + col, className: 'gx-head', id: baseId + '-' + col }, text);
      const cells = [head(t('colStage'), 'stage'), head(t('colModel'), 'model'), head(t('colEffort'), 'effort')];
      for (const row of state.rows) {
        const stageId = baseId + '-' + row.stage;
        cells.push(
          h('div', { key: row.stage + '-s', className: 'gx-cell', 'data-col': 'stage' },
            h('span', { className: 'gx-stage', id: stageId }, t('stage_' + row.stage)),
            h('span', { className: 'gx-desc' }, t('stage_' + row.stage + '_desc'))),
          h('div', { key: row.stage + '-m', className: 'gx-cell', 'data-col': 'model' },
            h(ModelSelect, { t, row, state, disabled, onChange: props.setModel, labelId: stageId + ' ' + baseId + '-model' }),
            row.known ? null : h('span', { className: 'gx-warn', role: 'alert' }, t('unavailableHint'))),
          h('div', { key: row.stage + '-e', className: 'gx-cell', 'data-col': 'effort' },
            h(EffortSelect, { t, row, disabled, onChange: props.setEffort, labelId: stageId + ' ' + baseId + '-effort' })),
        );
      }
      return h(primitives.SettingsForm, {
        labels: { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') },
        state,
        onSave: props.save,
        onDiscard: props.discard,
        children: [
          h('section', { key: 'body' },
            h('p', { className: 'gx-intro' }, t('intro')),
            h(CatalogNotice, { t, state, retry: props.retryCatalog }),
            state.conflicted ? h('div', { className: 'gx-notice', 'data-tone': 'error', role: 'alert' }, t('conflict')) : null,
            h('div', { className: 'gx-table', role: 'group', 'aria-label': t('title') }, cells),
            h('div', { className: 'gx-foot' },
              h('p', { className: 'gx-footnote' }, t('footnote')),
              h('button', { type: 'button', className: 'gx-link', disabled: disabled || !state.anySet, onClick: props.resetAll }, t('resetAll')))),
        ],
      });
    }

    // ---------------------------------------------------------------- 挂载
    const inject = ['slots', 'locale', 'remote', 'remote.session', 'configForms'];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'gauntlet-settings: dictionaries');
      const card = new GauntletCardController(ctx.configForms.get(CONFIG_NS), ctx);
      const face = card.inject();
      ctx.effect(() => ctx.remote.$on('llm/adapters-updated', () => card.refreshCatalog()), 'gauntlet-settings: adapter invalidations');
      ctx.effect(() => ctx.remote.$on('settings/document-updated', () => card.refreshCatalog()), 'gauntlet-settings: settings invalidations');
      ctx.effect(() => ctx.on('connection/reset', () => card.resetConnection()), 'gauntlet-settings: connection generation');
      ctx.effect(() => () => card.dispose(), 'gauntlet-settings: form subscription');
      // 第三方 bundle 的配置用 plugins.bundle.config（按包名），显示在「已安装 → dsh-gauntlet」页上；
      // plugins.item 是官方插件专用的（会被列进「官方」分组）。
      ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PACKAGE,
        locale: NS,
        inject: () => face,
      }, GauntletCard))), 'gauntlet-settings: page');
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
