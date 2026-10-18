window.__ModuleLoader__.load({
  id: '@local/dsh-skills-panel',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace owned by this plugin. */
    const NS = 'skills-panel';
    /** The sidebar panel id; it doubles as the `main` slot key. */
    const PANEL_ID = 'skills';
    /** Remembers the Session whose catalog the panel last showed. */
    const STORAGE_KEY = 'dsh-skills-panel.session';
    /** Group order for the rendered catalog. */
    const SOURCES = ['project', 'user', 'bundled', 'other'];

    const zh = {
      'panel.label': '技能',
      'page.title': '技能',
      'page.subtitle': '当前会话可用的技能目录',
      'page.subtitleSession': '{session} · {count} 个技能',
      'page.refresh': '刷新',
      'page.search': '搜索名称或用途',
      'page.session': '会话',
      'page.copy': '复制',
      'page.copied': '已复制',
      'page.failedCopy': '复制失败',
      'page.userOnly': '仅用户',
      'page.more': '何时使用',
      'page.empty': '这个会话没有可用技能',
      'page.emptyHint': '在项目 .agents/skills 或用户 ~/.dsh/skills 下新增技能后会出现在这里。',
      'page.noSession': '还没有可查看的会话',
      'page.noSessionHint': '技能目录按会话的工作区与 agent preset 解析，先打开一个会话。',
      'page.loading': '正在读取技能目录…',
      'page.failed': '读取技能目录失败',
      'page.retry': '重试',
      'page.noMatches': '没有匹配的技能',
      'source.project': '项目',
      'source.user': '用户',
      'source.bundled': '内置',
      'source.other': '其它',
    };

    const en = {
      'panel.label': 'Skills',
      'page.title': 'Skills',
      'page.subtitle': 'Skills available to the current Session',
      'page.subtitleSession': '{session} · {count} skills',
      'page.refresh': 'Refresh',
      'page.search': 'Search name or purpose',
      'page.session': 'Session',
      'page.copy': 'Copy',
      'page.copied': 'Copied',
      'page.failedCopy': 'Copy failed',
      'page.userOnly': 'user only',
      'page.more': 'When to use',
      'page.empty': 'This Session has no available skills',
      'page.emptyHint': 'Skills added under the project .agents/skills or user ~/.dsh/skills directories appear here.',
      'page.noSession': 'No Session to inspect',
      'page.noSessionHint': 'The skill catalog is resolved from a Session working directory and agent preset. Open a Session first.',
      'page.loading': 'Reading the skill catalog…',
      'page.failed': 'Could not read the skill catalog',
      'page.retry': 'Retry',
      'page.noMatches': 'No matching skills',
      'source.project': 'Project',
      'source.user': 'User',
      'source.bundled': 'Bundled',
      'source.other': 'Other',
    };

    const CSS = [
      '.dsh-skills-panel-page{display:flex;flex-direction:column;width:100%;max-width:100%;height:100%;min-width:0;min-height:0;overflow-x:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;}',
      '.dsh-skills-panel-scroll{flex:1 1 auto;display:flex;justify-content:center;width:100%;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;}',
      '.dsh-skills-panel-content{box-sizing:border-box;flex:0 1 820px;width:820px;max-width:100%;min-width:0;padding:40px 32px 72px;}',
      '.dsh-skills-panel-head{display:flex;flex-direction:column;gap:2px;}',
      '.dsh-skills-panel-titleRow{display:flex;align-items:center;gap:12px;min-width:0;}',
      '.dsh-skills-panel-title{margin:0;font-size:22px;font-weight:600;letter-spacing:-0.015em;line-height:1.25;}',
      '.dsh-skills-panel-sub{margin:7px 0 0;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}',
      '.dsh-skills-panel-iconBtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:color .12s ease,border-color .12s ease,background-color .12s ease;}',
      '.dsh-skills-panel-iconBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);}',
      '.dsh-skills-panel-iconBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dsh-skills-panel-iconBtn[data-busy="true"] svg{animation:dsh-skills-panel-spin .9s linear infinite;}',
      '.dsh-skills-panel-refresh{flex:none;display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:1;cursor:pointer;white-space:nowrap;transition:color .12s ease,border-color .12s ease,background-color .12s ease;}',
      '.dsh-skills-panel-refresh:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}',
      '.dsh-skills-panel-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dsh-skills-panel-refresh[data-busy="true"] svg{animation:dsh-skills-panel-spin .9s linear infinite;}',
      '@keyframes dsh-skills-panel-spin{to{transform:rotate(360deg);}}',
      '.dsh-skills-panel-toolbar{display:flex;align-items:center;gap:10px;margin-top:28px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l1);}',
      '.dsh-skills-panel-field{display:inline-flex;align-items:center;gap:7px;flex:none;min-width:0;max-width:46%;}',
      '.dsh-skills-panel-fieldLabel{flex:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);}',
      '.dsh-skills-panel-select{min-width:0;max-width:100%;height:28px;padding:0 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;}',
      '.dsh-skills-panel-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dsh-skills-panel-search{flex:1 1 auto;min-width:0;height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12.5px;}',
      '.dsh-skills-panel-search::placeholder{color:var(--dsw-alias-label-secondary);opacity:.75;}',
      '.dsh-skills-panel-search:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;border-color:transparent;}',
      '.dsh-skills-panel-group{margin-top:36px;}',
      '.dsh-skills-panel-group:first-of-type{margin-top:30px;}',
      '.dsh-skills-panel-groupHead{display:flex;align-items:baseline;gap:9px;margin:0 0 2px;font-size:10.5px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);}',
      '.dsh-skills-panel-groupHead span{font-weight:500;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums;opacity:.8;}',
      '.dsh-skills-panel-list{margin:0;padding:0;list-style:none;}',
      '.dsh-skills-panel-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:2px 18px;padding:15px 0 14px;border-bottom:1px solid var(--dsw-alias-border-l1);}',
      '.dsh-skills-panel-list li:last-child .dsh-skills-panel-row{border-bottom:0;}',
      '.dsh-skills-panel-rowMain{min-width:0;}',
      '.dsh-skills-panel-rowHead{display:flex;align-items:center;flex-wrap:wrap;gap:8px;}',
      '.dsh-skills-panel-name{margin:0;font-family:ui-monospace,SFMono-Regular,"JetBrains Mono",Menlo,Consolas,monospace;font-size:12.5px;font-weight:500;letter-spacing:-0.01em;color:var(--dsw-alias-label-primary);word-break:break-word;}',
      '.dsh-skills-panel-badge{flex:none;padding:1px 5px;border:1px solid var(--dsw-alias-border-l1);border-radius:3px;font-size:10px;line-height:1.5;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);white-space:nowrap;}',
      '.dsh-skills-panel-badge[data-kind="userOnly"]{border-style:dashed;}',
      '.dsh-skills-panel-desc{margin:6px 0 0;max-width:100%;font-size:13px;line-height:1.62;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.dsh-skills-panel-when{margin:5px 0 0;max-width:100%;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);opacity:.82;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}',
      '.dsh-skills-panel-when em{font-style:normal;letter-spacing:.02em;opacity:.72;margin-right:6px;}',
      '.dsh-skills-panel-copy{align-self:center;flex:none;padding:4px 9px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;opacity:0;transition:opacity .12s ease,color .12s ease,border-color .12s ease;}',
      '.dsh-skills-panel-row:hover .dsh-skills-panel-copy,.dsh-skills-panel-row:focus-within .dsh-skills-panel-copy,.dsh-skills-panel-copy[data-active="true"]{opacity:1;}',
      '.dsh-skills-panel-copy:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1);}',
      '.dsh-skills-panel-copy:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '.dsh-skills-panel-copy[data-active="true"]{color:var(--dsw-alias-state-success-primary);}',
      '.dsh-skills-panel-state{margin:40px 0 0;padding:22px 0 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:13px;line-height:1.7;color:var(--dsw-alias-label-secondary);}',
      '.dsh-skills-panel-state strong{display:block;margin-bottom:4px;font-size:13.5px;font-weight:600;color:var(--dsw-alias-label-primary);}',
      '.dsh-skills-panel-state button{margin-top:12px;padding:5px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;}',
      '.dsh-skills-panel-state button:hover{background:var(--dsw-alias-bg-layer-1);}',
      '.dsh-skills-panel-state button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}',
      '@media (hover:none){.dsh-skills-panel-copy{opacity:1;}}',
      '@media (max-width:560px){.dsh-skills-panel-content{padding:26px 18px 56px;}.dsh-skills-panel-toolbar{flex-wrap:wrap;}.dsh-skills-panel-field{max-width:100%;width:100%;}.dsh-skills-panel-search{width:100%;flex-basis:100%;}}',
      '@media (prefers-reduced-motion:reduce){.dsh-skills-panel-iconBtn,.dsh-skills-panel-copy{transition:none;}.dsh-skills-panel-iconBtn[data-busy="true"] svg{animation:none;}}',
    ].join('\n');

    /** Pick the dictionary for one locale id. */
    function pickDict(id) {
      const value = String(id || '').toLowerCase();
      return value.startsWith('zh') ? zh : en;
    }

    /** Build a translate function that reads the live locale on every call. */
    function createTranslate(ctx) {
      return function tr(key, vars) {
        let active = '';
        try {
          const snapshot = ctx.locale.getLocale();
          active = snapshot && snapshot.active;
        } catch (error) {
          /* locale is optional for rendering */
        }
        const dict = pickDict(active);
        let text = dict[key];
        if (text === undefined) text = en[key];
        if (text === undefined) return key;
        if (vars) {
          for (const name of Object.keys(vars)) {
            text = text.split('{' + name + '}').join(String(vars[name]));
          }
        }
        return text;
      };
    }

    /** Normalize a path for prefix comparison. */
    function normalizePath(value) {
      return String(value || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    }

    /** Group one skill by where it came from. */
    function classifySkill(skill, cwd) {
      const path = normalizePath(skill && skill.path);
      if (path === '') return 'other';
      if (path.indexOf('/node_modules/') !== -1 || path.indexOf('/app.asar/') !== -1 || path.indexOf('/resources/dsh/') !== -1) {
        return 'bundled';
      }
      const project = normalizePath(cwd);
      if (path.indexOf('/.agents/skills/') !== -1 || path.indexOf('/.dsh/skills/') !== -1) {
        if (project !== '' && path.indexOf(project + '/') === 0) return 'project';
        return 'user';
      }
      return 'other';
    }

    /** Display label for one Session row. */
    function sessionLabel(row, id) {
      if (!row) return id;
      const title = row.displayTitle || row.title;
      return title && String(title).trim() !== '' ? String(title) : id;
    }

    /** Copy helper with a selection fallback for restricted clipboards. */
    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (error) {
        /* fall through to the selection fallback */
      }
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
      } catch (error) {
        return false;
      }
    }

    /** Panel catalog state: Session selection, Remote reads, and invalidation. */
    function createStore(ctx, tr) {
      let state = {
        phase: 'idle',
        sessionId: null,
        skills: [],
        error: null,
        copied: null,
        copyFailed: null,
        epoch: 0,
      };
      const listeners = new Set();
      let requestSeq = 0;
      let inflight = null;
      let started = false;
      let loading = false;

      function publish(patch) {
        state = Object.assign({}, state, patch);
        for (const listener of Array.from(listeners)) {
          try {
            listener();
          } catch (error) {
            console.error('[skills-panel] listener failed', error);
          }
        }
      }

      function subscribe(onChange) {
        listeners.add(onChange);
        return () => {
          listeners.delete(onChange);
        };
      }

      function getSnapshot() {
        return state;
      }

      function sessionRows() {
        let snapshot = {};
        try {
          snapshot = ctx.sessions.list.getSnapshot() || {};
        } catch (error) {
          snapshot = {};
        }
        const byId = snapshot.byId && typeof snapshot.byId === 'object' ? snapshot.byId : {};
        const ids = Array.isArray(snapshot.ids) ? snapshot.ids : Object.keys(byId);
        return { ids, byId };
      }

      function rowOf(sessionId) {
        return sessionRows().byId[sessionId];
      }

      function cwdOf(sessionId) {
        const row = rowOf(sessionId);
        return row && row.cwd ? row.cwd : undefined;
      }

      function pickDefault() {
        const { ids, byId } = sessionRows();
        let fallback = null;
        let fallbackAt = -1;
        for (const id of ids) {
          const row = byId[id];
          if (!row) continue;
          const retained = row.retainedBy || {};
          if ((retained.mainView || 0) > 0) return id;
          const at = Number(row.updatedAt) || 0;
          if (at >= fallbackAt) {
            fallbackAt = at;
            fallback = id;
          }
        }
        return fallback;
      }

      function restore() {
        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored && rowOf(stored)) return stored;
        } catch (error) {
          /* storage is optional */
        }
        return null;
      }

      function resolveSession() {
        if (state.sessionId && rowOf(state.sessionId)) return state.sessionId;
        return restore() || pickDefault();
      }

      async function load() {
        const sessionId = resolveSession();
        const seq = ++requestSeq;
        if (inflight) {
          try {
            inflight.abort();
          } catch (error) {
            /* already settled */
          }
          inflight = null;
        }
        if (!sessionId) {
          publish({ phase: 'no-session', sessionId: null, skills: [], error: null });
          return;
        }
        const controller = new AbortController();
        inflight = controller;
        publish({ phase: 'loading', sessionId, error: null });
        try {
          const result = await ctx.remote.skills.list({ sessionId }, controller.signal);
          if (seq !== requestSeq) return;
          if (result && result.ok === false) {
            const detail = result.error || {};
            publish({ phase: 'error', error: detail.message || detail.code || 'skills/list failed' });
            return;
          }
          const value = result && result.ok === true ? result.value : result;
          const skills = value && Array.isArray(value.skills) ? value.skills : [];
          const sorted = skills.slice().sort((left, right) => {
            const leftSource = classifySkill(left, cwdOf(sessionId));
            const rightSource = classifySkill(right, cwdOf(sessionId));
            const order = SOURCES.indexOf(leftSource) - SOURCES.indexOf(rightSource);
            if (order !== 0) return order;
            return String(left.name).localeCompare(String(right.name));
          });
          publish({ phase: 'ready', skills: sorted, error: null });
        } catch (error) {
          if (seq !== requestSeq || controller.signal.aborted) return;
          publish({ phase: 'error', error: error && error.message ? error.message : String(error) });
        } finally {
          if (inflight === controller) inflight = null;
        }
      }

      function refresh() {
        if (loading) return;
        loading = true;
        void load().finally(() => {
          loading = false;
        });
      }

      function refreshIfLoaded() {
        if (state.phase === 'ready' || state.phase === 'error') refresh();
      }

      function selectSession(sessionId) {
        if (!sessionId) return;
        try {
          window.localStorage.setItem(STORAGE_KEY, sessionId);
        } catch (error) {
          /* storage is optional */
        }
        publish({ sessionId });
        refresh();
      }

      async function copy(name) {
        const ok = await copyText('/' + name);
        if (ok) {
          publish({ copied: name, copyFailed: null });
        } else {
          publish({ copied: null, copyFailed: name });
        }
        window.setTimeout(() => {
          if (state.copied === name || state.copyFailed === name) publish({ copied: null, copyFailed: null });
        }, 1600);
      }

      function touch() {
        publish({ epoch: state.epoch + 1 });
      }

      function ensureLoaded() {
        if (state.phase === 'idle') refresh();
      }

      function start() {
        if (started) return;
        started = true;
        try {
          ctx.effect(() => ctx.sessions.list.subscribe(() => {
            const { byId } = sessionRows();
            if (state.sessionId && !byId[state.sessionId]) {
              publish({ sessionId: null });
              refresh();
              return;
            }
            if (!state.sessionId) refresh();
            else touch();
          }), 'skills-panel: sessions');
        } catch (error) {
          console.error('[skills-panel] session subscription failed', error);
        }
        try {
          ctx.effect(() => ctx.locale.subscribe(() => touch()), 'skills-panel: locale');
        } catch (error) {
          console.error('[skills-panel] locale subscription failed', error);
        }
      }

      return {
        subscribe,
        getSnapshot,
        sessionRows,
        rowOf,
        cwdOf,
        load,
        refresh,
        refreshIfLoaded,
        ensureLoaded,
        selectSession,
        copy,
        start,
        translate: tr,
      };
    }

    /** Sidebar entry: the layered glyph the shell asks for. */
    function SkillsIcon({ size }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M8 2.15 L13.25 5.2 L8 8.25 L2.75 5.2 Z' }),
        h('path', { d: 'M2.75 8.5 L8 11.55 L13.25 8.5' }),
        h('path', { d: 'M2.75 11 L8 14.05 L13.25 11', opacity: 0.55 }),
      );
    }

    /** Small refresh glyph. */
    function RefreshIcon() {
      return h(
        'svg',
        {
          width: 13,
          height: 13,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M13 8a5 5 0 1 1-1.6-3.7' }),
        h('path', { d: 'M13 2.6V5.4H10.2' }),
      );
    }

    /** One catalog row. */
    function SkillRow(props) {
      const { skill, source, tr, copied, copyFailed, onCopy } = props;
      const copyLabel = copied ? tr('page.copied') : copyFailed ? tr('page.failedCopy') : tr('page.copy');
      return h(
        'li',
        null,
        h(
          'div',
          { className: 'dsh-skills-panel-row' },
          h(
            'div',
            { className: 'dsh-skills-panel-rowMain' },
            h(
              'div',
              { className: 'dsh-skills-panel-rowHead' },
              h('code', { className: 'dsh-skills-panel-name' }, '/' + skill.name),
              h('span', { className: 'dsh-skills-panel-badge' }, tr('source.' + source)),
              skill.modelInvocable === false
                ? h('span', { className: 'dsh-skills-panel-badge', 'data-kind': 'userOnly' }, tr('page.userOnly'))
                : null,
            ),
            h('p', { className: 'dsh-skills-panel-desc', title: skill.description || '' }, skill.description || ''),
            skill.whenToUse
              ? h(
                  'p',
                  { className: 'dsh-skills-panel-when', title: skill.whenToUse },
                  h('em', null, tr('page.more')),
                  skill.whenToUse,
                )
              : null,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-skills-panel-copy',
              'data-active': copied || copyFailed ? 'true' : 'false',
              'aria-label': tr('page.copy') + ' /' + skill.name,
              onClick: () => onCopy(skill.name),
            },
            copyLabel,
          ),
        ),
      );
    }

    /** Panel page: the sidebar entry's whole surface. */
    function SkillsPage(props) {
      const { tr, store } = props;
      const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
      const [query, setQuery] = React.useState('');

      React.useEffect(() => {
        store.ensureLoaded();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const { ids, byId } = store.sessionRows();
      const options = ids
        .map((id) => ({ id, row: byId[id] }))
        .filter((entry) => entry.row && !entry.row.parentId);

      const session = state.sessionId ? byId[state.sessionId] : undefined;
      const sessionTitle = state.sessionId ? sessionLabel(session, state.sessionId) : '';

      const cwd = state.sessionId ? store.cwdOf(state.sessionId) : undefined;
      const needle = query.trim().toLowerCase();
      const visible = state.skills.filter((skill) => {
        if (needle === '') return true;
        const haystack = ((skill.name || '') + ' ' + (skill.description || '') + ' ' + (skill.whenToUse || '')).toLowerCase();
        return haystack.indexOf(needle) !== -1;
      });

      const groups = SOURCES.map((source) => ({
        source,
        items: visible.filter((skill) => classifySkill(skill, cwd) === source),
      })).filter((group) => group.items.length > 0);

      const subtitle =
        state.phase === 'ready'
          ? tr('page.subtitleSession', { session: sessionTitle || tr('page.session'), count: state.skills.length })
          : tr('page.subtitle');

      const refreshButton = h(
        'button',
        {
          type: 'button',
          className: 'dsh-skills-panel-refresh',
          'data-busy': state.phase === 'loading' ? 'true' : 'false',
          onClick: () => store.refresh(),
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '24px',
            padding: '0 9px',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: '5px',
            background: 'transparent',
            color: 'var(--dsw-alias-label-secondary)',
            font: 'inherit',
            fontSize: '11.5px',
            lineHeight: '1',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          },
        },
        h(RefreshIcon),
        h('span', null, tr('page.refresh')),
      );

      const toolbar = h(
        'div',
        { className: 'dsh-skills-panel-toolbar' },
        options.length > 1
          ? h(
              'label',
              { className: 'dsh-skills-panel-field' },
              h('span', { className: 'dsh-skills-panel-fieldLabel' }, tr('page.session')),
              h(
                'select',
                {
                  className: 'dsh-skills-panel-select',
                  value: state.sessionId || '',
                  onChange: (event) => store.selectSession(event.target.value),
                },
                options.map((entry) =>
                  h('option', { key: entry.id, value: entry.id }, sessionLabel(entry.row, entry.id)),
                ),
              ),
            )
          : null,
        h('input', {
          type: 'search',
          className: 'dsh-skills-panel-search',
          placeholder: tr('page.search'),
          value: query,
          onChange: (event) => setQuery(event.target.value),
          'aria-label': tr('page.search'),
        }),
      );

      let body;
      if (state.phase === 'no-session') {
        body = h(
          'div',
          { className: 'dsh-skills-panel-state' },
          h('strong', null, tr('page.noSession')),
          tr('page.noSessionHint'),
        );
      } else if (state.phase === 'error') {
        body = h(
          'div',
          { className: 'dsh-skills-panel-state' },
          h('strong', null, tr('page.failed')),
          state.error || '',
          h('div', null, h('button', { type: 'button', onClick: () => store.refresh() }, tr('page.retry'))),
        );
      } else if (state.phase === 'idle' || state.phase === 'loading') {
        body = h('div', { className: 'dsh-skills-panel-state' }, tr('page.loading'));
      } else if (state.skills.length === 0) {
        body = h(
          'div',
          { className: 'dsh-skills-panel-state' },
          h('strong', null, tr('page.empty')),
          tr('page.emptyHint'),
        );
      } else if (visible.length === 0) {
        body = h('div', { className: 'dsh-skills-panel-state' }, tr('page.noMatches'));
      } else {
        body = groups.map((group) =>
          h(
            'section',
            { className: 'dsh-skills-panel-group', key: group.source },
            h(
              'h2',
              { className: 'dsh-skills-panel-groupHead' },
              tr('source.' + group.source),
              h('span', null, String(group.items.length)),
            ),
            h(
              'ul',
              { className: 'dsh-skills-panel-list' },
              group.items.map((skill) =>
                h(SkillRow, {
                  key: skill.name,
                  skill,
                  source: group.source,
                  tr,
                  copied: state.copied === skill.name,
                  copyFailed: state.copyFailed === skill.name,
                  onCopy: (name) => store.copy(name),
                }),
              ),
            ),
          ),
        );
      }

      return h(
        'section',
        {
          className: 'dsh-skills-panel-page',
          'aria-label': tr('panel.label'),
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
            overflowX: 'hidden',
            background: 'var(--dsw-alias-bg-base)',
            color: 'var(--dsw-alias-label-primary)',
          },
        },
        h('style', { key: 'dsh-skills-panel-style' }, CSS),
        h(
          'div',
          {
            className: 'dsh-skills-panel-scroll',
            style: {
              flex: '1 1 auto',
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              minWidth: 0,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
            },
          },
          h(
            'div',
            {
              className: 'dsh-skills-panel-content',
              style: {
                boxSizing: 'border-box',
                flex: '0 1 820px',
                width: '820px',
                maxWidth: '100%',
                minWidth: 0,
                padding: '40px 32px 72px',
              },
            },
            h(
              'header',
              { className: 'dsh-skills-panel-head' },
              h(
                'div',
                { className: 'dsh-skills-panel-titleRow' },
                h('h1', { className: 'dsh-skills-panel-title' }, tr('page.title')),
                refreshButton,
              ),
              h('p', { className: 'dsh-skills-panel-sub' }, subtitle),
            ),
            toolbar,
            body,
          ),
        ),
      );
    }

    /** Client half: one sidebar entry and its page. */
    function apply(ctx) {
      /** Run one registration and keep a failure from disabling the whole panel. */
      const guard = (label, run) => {
        try {
          return run();
        } catch (error) {
          console.error('[skills-panel] ' + label + ' failed', error);
          return undefined;
        }
      };

      guard('dictionaries', () => ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skills-panel: dictionaries'));

      const tr = createTranslate(ctx);
      const store = createStore(ctx, tr);
      guard('catalog store', () => store.start());

      guard('main slot', () =>
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({ tr, store }),
            },
            SkillsPage,
          ),
        ),
      );

      guard('sidebar slot', () =>
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              locale: NS,
              label: () => tr('panel.label'),
            },
            SkillsIcon,
          ),
        ),
      );

      guard('plugin invalidation', () =>
        ctx.effect(() => ctx.remote.$on('plugin-manager/changed', () => store.refreshIfLoaded()), 'skills-panel: plugin changes'),
      );
      guard('preset invalidation', () =>
        ctx.effect(() => ctx.remote.$on('agent-preset/selected', () => store.refreshIfLoaded()), 'skills-panel: preset changes'),
      );
      guard('reconnect invalidation', () =>
        ctx.effect(() => ctx.on('connection/reset', () => store.refreshIfLoaded()), 'skills-panel: reconnects'),
      );
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'remote', 'remote.skills'],
      apply,
    };
  },
});
