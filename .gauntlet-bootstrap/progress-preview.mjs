import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const html = String.raw`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Gauntlet 右侧面板 · 模拟预览</title>
<style>
:root{--dsw-alias-label-primary:#20242d;--dsw-alias-label-secondary:#657080;--dsw-alias-label-tertiary:#7a8494;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f6f7f9;--dsw-alias-border-l2:#e0e3e9;--dsw-alias-border-l3:#d5d8df;--dsw-alias-brand-primary:#4263eb;--dsw-alias-interactive-bg-hover:#f1f4f8;--dsw-radius-md:6px}*{box-sizing:border-box}html,body{height:100%;margin:0}body{font-family:system-ui,'Microsoft Yahei',sans-serif;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-size:13px}select,button,input{font:inherit}select,button{color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l3);border-radius:6px;padding:5px 8px}button{cursor:pointer}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 14px;font-size:12px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.controls label{display:flex;gap:6px;align-items:center}.preview-label{font-size:11px;border:1px solid #cbb276;color:#936f27;background:#fff7df;padding:3px 7px;border-radius:5px}main{display:grid;grid-template-columns:minmax(0,1fr) 430px;min-height:0;flex:1}.chat{display:flex;flex-direction:column;min-width:0;min-height:0}.chat-header{height:58px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dsw-alias-border-l2)}.chat-header small{color:var(--dsw-alias-label-tertiary)}.messages{flex:1;overflow:auto;padding:46px max(28px,calc((100% - 760px)/2));font-size:15px;line-height:1.9}.user-message{display:flex;justify-content:flex-end;margin-bottom:34px}.user-message p{background:var(--dsw-alias-bg-layer-2);padding:12px 18px;border-radius:14px;max-width:90%;margin:0}.messages p{margin:0 0 20px}.command{font-size:13px;color:var(--dsw-alias-label-tertiary);margin:8px 0 16px}.messages code{font-size:13px;padding:2px 6px;background:var(--dsw-alias-bg-layer-2);border-radius:4px}.leader-status{color:var(--dsw-alias-brand-primary);font-size:13px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:16px;margin-top:30px}.composer-wrap{padding:16px 28px 10px;flex:none}.composer{max-width:780px;margin:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:22px;padding:18px;box-shadow:0 4px 20px #16254107}.placeholder{color:var(--dsw-alias-label-tertiary);padding-bottom:36px}.composer-actions{display:flex;align-items:center;gap:16px;font-size:12px;color:var(--dsw-alias-label-secondary)}.model{margin-left:auto}.send-circle{display:grid;place-items:center;border-radius:50%;width:30px;height:30px;background:var(--dsw-alias-brand-primary);color:white}.preview-note{text-align:center;margin:10px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary)}.native-pane{border-left:1px solid var(--dsw-alias-border-l2);min-height:0;display:flex;flex-direction:column;min-width:0}.native-tabs{height:46px;display:flex;align-items:center;gap:16px;padding:0 18px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px}.native-tabs strong{height:46px;display:flex;align-items:center;border-bottom:2px solid var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}.native-tabs .collapse{margin-left:auto}.pane-scroll{flex:1;overflow:auto;min-height:0}body.dark{--dsw-alias-label-primary:#e5e9f1;--dsw-alias-label-secondary:#b0b8c9;--dsw-alias-label-tertiary:#929caf;--dsw-alias-bg-layer-1:#171c26;--dsw-alias-bg-layer-2:#202530;--dsw-alias-border-l2:#343c49;--dsw-alias-border-l3:#455063;--dsw-alias-interactive-bg-hover:#303747;--dsw-alias-brand-primary:#7394ff}body.dark .preview-label{background:#38301d;color:#e6c780;border-color:#6f603c}@media(max-width:900px){main{grid-template-columns:minmax(0,1fr) 400px}.messages{padding:30px 24px}}@media(max-width:700px){.controls{padding:10px 12px;gap:8px;font-size:11px}main{display:block}.chat{display:none}.native-pane{height:100%;border-left:0}}
#mock-save-status{flex:0 0 60px;max-width:60px;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-secondary)}.mock-config-debug{position:relative;flex:none;font-size:12px}.mock-config-debug>summary{cursor:pointer;white-space:nowrap;padding:5px 0}.mock-config-debug-body{position:absolute;top:calc(100% + 6px);right:0;z-index:50;width:250px;padding:12px;display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px #16254116}.mock-config-debug-body>p{margin:0;font-size:11px;line-height:1.6;overflow-wrap:anywhere}.mock-config-debug-body>button{width:100%;text-align:left}</style><body><div class="controls"><span class="preview-label">模拟数据预览</span><label>状态 <select id="scenario"><option value="live">编码进行中</option><option value="retry">回退返工</option><option value="waiting">等待确认</option><option value="interrupted">已中断</option><option value="complete">全部通过</option><option value="empty">尚未开始</option><option value="standard">普通模式</option><option value="child">子 agent 会话</option></select></label><label><input type="checkbox" id="dark">深色</label><label>语言 <select id="locale"><option value="zh">中文</option><option value="en">English</option></select></label><button id="mobile">窄屏预览</button></div><main><section class="chat"><header class="chat-header"><strong>为项目添加搜索筛选</strong><small>Gauntlet 小队 · 1 个子智能体</small></header><div class="messages"><div class="user-message"><p>实现搜索筛选，保留旧接口。测试和变异测试的细节都需要能查到。</p></div><p>摸底和规格阶段已通过。已经把需求拆成 25 条验收场景，正在实现搜索解析、筛选面板和输入校验。</p><div class="command">› 执行了命令</div><p><code>npm test -- --runInBand</code> 已验证 24 / 25 条场景。空查询的边界场景还在修复，编码 agent 正在补测试。</p><p>右侧可以展开阶段，查看派发任务、完整工具记录和阶段完成时的质量快照。当前工作区报告保留了函数复杂度、覆盖率、CRAP 和每个变异体的结果。</p><div class="leader-status" id="leader-status">深度求索中 · 编码 agent 正在执行验收测试…</div></div><div class="composer-wrap"><div class="composer"><div class="placeholder">发消息或创建任务，/ 调用指令，@ 文件或对话</div><div class="composer-actions"><span>＋</span><span>完全权限⌄</span><span>阶段模型</span><span class="model">DeepSeek V4.1 Flash Max⌄</span><span class="send-circle">■</span></div></div><p class="preview-note" id="opened-status">实际插件组件 · 会话与报告均为模拟数据</p></div></section><aside class="native-pane" aria-label="模拟宿主右侧面板"><nav class="native-tabs"><strong>Gauntlet</strong><span>文件</span><span>＋</span><span class="collapse">◧</span></nav><div class="pane-scroll" id="root"></div></aside></main>
<script src="https://unpkg.com/react@18.2.0/umd/react.development.js"></script><script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.development.js"></script><script>
const h=React.createElement,components={},dictionaries={};let plugin;
const jsx=(tag,props)=>{const {children,...attributes}=props;return h(tag,attributes,...(Array.isArray(children)?children:children===undefined?[]:[children]))},jsxs=jsx;
const SHIELD_OUTLINE_PATH = "M6.80132 2.14853C7.70663 1.80917 8.70422 1.80919 9.60952 2.14859L14.1296 3.84317V7.11961C14.1296 11.6089 10.7615 13.5975 8.20543 14.5779C5.64931 13.5975 2.28052 11.6089 2.28052 7.11961V3.84317L6.80132 2.14853Z";
const IconSearchOutlineArtwork = ({ size = 16, className, strokeWidth }) => jsxs("svg", {
	width: size,
	height: size,
	className,
	viewBox: "0 0 16 16",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	"aria-hidden": "true",
	strokeWidth,
	children: [jsx("path", {
		d: "M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z",
		stroke: "currentColor"
	}), jsx("path", {
		d: "M10.2991 10.3933L14.7783 14.8725",
		stroke: "currentColor"
	})]
});
/** Regular one-pixel IconSearchOutline artwork. */
const IconSearchOutlineRegular = (props) => jsx(IconSearchOutlineArtwork, {
	...props,
	strokeWidth: 1
});
const IconListPenOutlineArtwork = ({ size = 16, className, strokeWidth }) => jsxs("svg", {
	width: size,
	height: size,
	className,
	viewBox: "0 0 16 16",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	"aria-hidden": "true",
	strokeWidth,
	children: [
		jsx("path", {
			d: "M4.9375 5.90295H11.0625",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M4.9375 9.02991H8.27841",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M12.5 1.32617C13.3039 1.32617 14 1.95171 14 2.77637V7.61328L13 8.68164V2.77637C13 2.55186 12.8007 2.32617 12.5 2.32617H3.5C3.1993 2.32617 3 2.55186 3 2.77637V13.2246C3.00044 13.4489 3.19963 13.6738 3.5 13.6738H8.32812L7.39258 14.6738H3.5C2.69637 14.6738 2.00042 14.0489 2 13.2246V2.77637C2 1.95171 2.69613 1.32617 3.5 1.32617H12.5Z",
			fill: "currentColor"
		}),
		jsx("path", {
			d: "M8.97212 14.3693C9.17511 14.5723 9.37811 14.7753 9.5811 14.9783C9.67012 14.8953 9.75914 14.8123 9.84815 14.7293C11.4505 13.2352 13.0528 11.7411 14.6551 10.247C14.7441 10.164 14.8331 10.081 14.9221 9.99803C14.5989 9.6748 14.2756 9.35157 13.9524 9.02834C13.8694 9.11736 13.7864 9.20637 13.7034 9.29539C12.2093 10.8977 10.7152 12.5 9.22113 14.1023C9.13813 14.1913 9.05513 14.2803 8.97212 14.3693Z",
			fill: "currentColor"
		}),
		jsx("path", {
			d: "M11.6323 13.7841C11.6323 14.0395 11.6323 14.295 11.6323 14.5504C11.6812 14.5523 11.7301 14.5543 11.779 14.5562C12.659 14.5913 13.539 14.6263 14.419 14.6614C14.4679 14.6633 14.5168 14.6653 14.5657 14.6672C14.5657 14.3339 14.5657 14.0006 14.5657 13.6672C14.5168 13.6692 14.4679 13.6711 14.419 13.6731C13.539 13.7081 12.659 13.7432 11.779 13.7783C11.7301 13.7802 11.6812 13.7821 11.6323 13.7841Z",
			fill: "currentColor"
		})
	]
});
/** Regular one-pixel IconListPenOutline artwork. */
const IconListPenOutlineRegular = (props) => jsx(IconListPenOutlineArtwork, {
	...props,
	strokeWidth: 1
});
const IconCodeOutlineArtwork = ({ size = 16, className, strokeWidth }) => jsxs("svg", {
	width: size,
	height: size,
	className,
	viewBox: "0 0 16 16",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	"aria-hidden": "true",
	strokeWidth,
	children: [
		jsx("path", {
			d: "M6.27612 1.5L4.52612 14.5",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M11.4739 1.5L9.72388 14.5",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M2.39868 5.5H14.0681",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M1.93188 10.5H13.6013",
			stroke: "currentColor"
		})
	]
});
/** Regular one-pixel IconCodeOutline artwork. */
const IconCodeOutlineRegular = (props) => jsx(IconCodeOutlineArtwork, {
	...props,
	strokeWidth: 1
});
const IconSlidersTwoOutlineArtwork = ({ size = 16, className, strokeWidth }) => jsxs("svg", {
	width: size,
	height: size,
	className,
	viewBox: "0 0 16 16",
	fill: "none",
	stroke: "currentColor",
	strokeLinecap: "round",
	"aria-hidden": "true",
	strokeWidth,
	children: [
		jsx("path", { d: "M2.3 5h5.85M12.05 5h1.65" }),
		jsx("circle", {
			cx: "9.95",
			cy: "5",
			r: "1.45"
		}),
		jsx("path", { d: "M2.3 11h1.65M7.85 11h5.85" }),
		jsx("circle", {
			cx: "5.75",
			cy: "11",
			r: "1.45"
		})
	]
});
/** Regular one-pixel IconSlidersTwoOutline artwork. */
const IconSlidersTwoOutlineRegular = (props) => jsx(IconSlidersTwoOutlineArtwork, {
	...props,
	strokeWidth: 1
});
const IconShieldOutlineArtwork = ({ size = 16, className, strokeWidth }) => jsx("svg", {
	width: size,
	height: size,
	className,
	viewBox: "0 0 16 16",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	"aria-hidden": "true",
	strokeWidth,
	children: jsx("path", {
		d: SHIELD_OUTLINE_PATH,
		stroke: "currentColor",
		strokeLinejoin: "round"
	})
});
/** Regular one-pixel IconShieldOutline artwork. */
const IconShieldOutlineRegular = (props) => jsx(IconShieldOutlineArtwork, {
	...props,
	strokeWidth: 1
});
const IconChecklistOutlineArtwork = ({ size = 14, className, strokeWidth }) => jsxs("svg", {
	width: size,
	height: size,
	className,
	viewBox: "0 0 16 16",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	"aria-hidden": "true",
	strokeWidth,
	children: [
		jsx("path", {
			d: "M3.75 6.25C4.7165 6.25 5.5 5.4665 5.5 4.5C5.5 3.5335 4.7165 2.75 3.75 2.75C2.7835 2.75 2 3.5335 2 4.5C2 5.4665 2.7835 6.25 3.75 6.25Z",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M7.5 4.5H13.5",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M3.75 13.25C4.7165 13.25 5.5 12.4665 5.5 11.5C5.5 10.5335 4.7165 9.75 3.75 9.75C2.7835 9.75 2 10.5335 2 11.5C2 12.4665 2.7835 13.25 3.75 13.25Z",
			stroke: "currentColor"
		}),
		jsx("path", {
			d: "M7.5 11.5H13.5",
			stroke: "currentColor"
		})
	]
});
/** Regular one-pixel IconChecklistOutline artwork. */
const IconChecklistOutlineRegular = (props) => jsx(IconChecklistOutlineArtwork, {
	...props,
	strokeWidth: 1
});
const IconArchiveCheckOutlineArtwork = ({ size = 16, className, strokeWidth }) => jsxs("svg", {
	width: size,
	height: size,
	className,
	viewBox: "0 0 16 16",
	fill: "none",
	stroke: "currentColor",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	strokeWidth,
	children: [
		jsx("rect", {
			x: "1.9",
			y: "2.1",
			width: "12.2",
			height: "3.4",
			rx: "1.1"
		}),
		jsx("path", { d: "M2.95 5.7v4.8a2.9 2.9 0 0 0 2.9 2.9h4.3a2.9 2.9 0 0 0 2.9-2.9V5.7" }),
		jsx("path", { d: "m6 9.35 1.4 1.4 2.6-2.6" })
	]
});
/** Regular one-pixel IconArchiveCheckOutline artwork. */
const IconArchiveCheckOutlineRegular = (props) => jsx(IconArchiveCheckOutlineArtwork, {
	...props,
	strokeWidth: 1
});
const previewPrimitives={Modal:()=>null,Button:p=>h('button',p,p.children),IconSearchOutlineRegular,IconListPenOutlineRegular,IconCodeOutlineRegular,IconSlidersTwoOutlineRegular,IconShieldOutlineRegular,IconChecklistOutlineRegular,IconArchiveCheckOutlineRegular};
function store(initial){let value=initial;const listeners=new Set();return{getSnapshot:()=>value,subscribe:f=>{listeners.add(f);return()=>listeners.delete(f)},set:next=>{value=next;listeners.forEach(f=>f())}}}
const modelCatalog={groups:[{id:'deepseek',name:'DeepSeek（模拟目录）',models:[{id:'deepseek-v4.1-flash-max',name:'DeepSeek V4.1 Flash Max',reasoning:{efforts:[{id:'low',name:'低'},{id:'medium',name:'中'},{id:'high',name:'高'}],defaultEffort:'medium'}},{id:'deepseek-v4.1-pro',name:'DeepSeek V4.1 Pro',reasoning:{efforts:[{id:'medium',name:'中'},{id:'high',name:'高'},{id:'max',name:'最高'}],defaultEffort:'high'}}]},{id:'local',name:'Local（模拟目录）',models:[{id:'local-coder',name:'Local Coder',reasoning:{efforts:[],defaultEffort:null}}]}],failures:[]};
const modelScope=store({status:'ready',writable:true,revision:1,value:{stages:{coder:{provider:'deepseek',model:'deepseek-v4.1-pro',reasoningEffort:'high'},hardener:{provider:'deepseek',model:'deepseek-v4.1-pro',reasoningEffort:'max'}}}});
const savedStatus=document.createElement('span');savedStatus.id='mock-save-status';savedStatus.setAttribute('role','status');savedStatus.textContent='未保存';savedStatus.title='模拟配置 · 尚未保存';document.querySelector('.controls').append(savedStatus);
const configDebug=document.createElement('details');configDebug.id='mock-config-debug';configDebug.className='mock-config-debug';const debugSummary=document.createElement('summary');debugSummary.textContent='配置调试';const debugBody=document.createElement('div');debugBody.className='mock-config-debug-body';const debugStatus=document.createElement('p');debugStatus.textContent='模拟配置 · 尚未保存';configDebug.append(debugSummary,debugBody);debugBody.append(debugStatus);document.querySelector('.controls').append(configDebug);
function showMockStatus(text){const subject=text.startsWith('模型')?'模型':text.startsWith('质量')?'质量':'配置';savedStatus.textContent=subject+(/冲突/.test(text)?'冲突':/已保存/.test(text)?'已保存':/外部/.test(text)?'已修改':'已更新');savedStatus.title='模拟配置 · '+text;debugStatus.textContent='模拟配置 · '+text}
function clone(value){return JSON.parse(JSON.stringify(value))}
modelScope.mutate=async(operations,revision)=>{await new Promise(resolve=>setTimeout(resolve,120));const before=modelScope.getSnapshot();if(revision!==before.revision){showMockStatus('模型保存冲突，修订号已变化');throw new Error('Mock config revision conflict')}const value=clone(before.value);for(const operation of operations){if(operation.op!=='set'||!Array.isArray(operation.path)||!operation.path.length||operation.path.some(key=>['__proto__','constructor','prototype'].includes(key)))throw new Error('Unsupported mock config operation');let target=value;for(const key of operation.path.slice(0,-1)){if(!target[key]||typeof target[key]!=='object')target[key]={};target=target[key]}target[operation.path.at(-1)]=clone(operation.value)}modelScope.set({...before,revision:before.revision+1,value});showMockStatus('模型已保存 · '+Object.keys(value.stages||{}).length+' 个自定义阶段 · revision '+(before.revision+1));return{ok:true}};
const conflictModels=document.createElement('button');conflictModels.id='mock-model-conflict';conflictModels.textContent='模拟模型外部修改';conflictModels.onclick=()=>{const before=modelScope.getSnapshot(),value=clone(before.value);value.stages.specifier={provider:'deepseek',model:value.stages.specifier?.model==='deepseek-v4.1-pro'?'deepseek-v4.1-flash-max':'deepseek-v4.1-pro'};modelScope.set({...before,revision:before.revision+1,value});showMockStatus('模型被外部修改 · revision '+(before.revision+1))};debugBody.append(conflictModels);
const qualityDefaults={crapMax:8,complexityMax:10,functionLinesMax:60,nestingMax:4,paramsMax:7,lineCoverageMin:.9,mutationScoreMin:1,duplicationMax:.03,warningsMax:0,tidyMax:0,staticScopeMin:1,cppcheckMax:0};
const qualityStates=new Map();
function qualityProject(id){if(!qualityStates.has(id))qualityStates.set(id,{base:{adapter:'commands',outDir:'gauntlet-out',paths:{qa:'qa'},commands:{build:'npm run build',test:'npm test'},thresholds:clone(qualityDefaults)},local:{tools:{mutation:{executable:'mock-mutator'}},notes:'保留的模拟本机配置'},baseVersion:1,localVersion:1});return qualityStates.get(id)}
function qualityLoaded(id){const project=qualityProject(id);return{status:'ready',values:{...qualityDefaults,...project.base.thresholds,...project.local.thresholds},base:clone(project.base),local:clone(project.local),revision:{base:'mock-base-'+project.baseVersion,local:'mock-local-'+project.localVersion},baseStatus:'ready',localStatus:'ready',paths:{base:'gauntlet.config.json',local:'gauntlet.local.json'}}}
async function qualityRpc(path,method,payload,signal){if(path!=='/api'||!['gauntletQuality/load','gauntletQuality/save'].includes(method))throw new Error('Unsupported mock RPC: '+path+' '+method);const cancelled=()=>{if(signal?.aborted){const error=new Error('Mock request cancelled');error.name='AbortError';throw error}};cancelled();await new Promise(resolve=>setTimeout(resolve,70));cancelled();const args=payload?.args||{},id=args.workspaceFileScopeId;if(typeof id!=='string'||!id)return{ok:false,error:{message:'Mock workspace scope is required'}};if(method==='gauntletQuality/load')return{ok:true,value:qualityLoaded(id)};const loaded=qualityLoaded(id);if(args.revision?.base!==loaded.revision.base||args.revision?.local!==loaded.revision.local){showMockStatus('质量保存冲突，工作区配置被外部修改');return{ok:true,value:{status:'error',code:'conflict',error:'模拟工作区配置已经变化，请重新加载后再保存。'}}}const changes=args.changes;if(!changes||Array.isArray(changes)||typeof changes!=='object')return{ok:true,value:{status:'error',code:'invalid-threshold',error:'模拟质量修改必须是字段对象'}};for(const [key,value]of Object.entries(changes)){const ratio=['lineCoverageMin','mutationScoreMin','duplicationMax','staticScopeMin'].includes(key),integer=!ratio&&key!=='crapMax',min=0;if(!(key in qualityDefaults)||typeof value!=='number'||!Number.isFinite(value)||value<min||ratio&&value>1||integer&&!Number.isSafeInteger(value)||value>Number.MAX_SAFE_INTEGER)return{ok:true,value:{status:'error',code:'invalid-threshold',error:'模拟阈值不合法：'+key}}}const project=qualityProject(id);if(Object.keys(changes).length){project.local={...project.local,thresholds:{...project.local.thresholds,...clone(changes)}};project.localVersion++}showMockStatus('质量已保存 · '+Object.keys(changes).join(', ')+' · local revision '+project.localVersion);savedStatus.title=JSON.stringify(project.local,null,2);return{ok:true,value:qualityLoaded(id)}}
const conflictQuality=document.createElement('button');conflictQuality.id='mock-quality-conflict';conflictQuality.textContent='模拟质量外部修改';conflictQuality.onclick=()=>{const id=window.__gauntletPreview.currentSessionId||'preview-live',project=qualityProject(id);project.base={...project.base,thresholds:{...project.base.thresholds,crapMax:project.base.thresholds.crapMax===8?7:8}};project.baseVersion++;showMockStatus('质量规则被外部修改 · base revision '+project.baseVersion)};debugBody.append(conflictQuality);
window.__gauntletPreview={modelScope,modelCatalog,qualityStates,qualityProject,qualityLoaded,readSavedQuality:id=>clone(qualityProject(id).local)};
window.__ModuleLoader__={load:def=>{plugin=def.factory(name=>name==='react'?React:name==='@deepseek-ai/dsh-client-ui-primitives'?previewPrimitives:{createSnapshotStore:store})}};
</script><script src="/client.js"></script><script>
const keys=['surveyor','specifier','coder','cleaner','hardener','qa','reporter'];let scenario='live',locale='zh',sessionId='preview-live',currentReports={},snapshots={};const sessions=new Map();
const ctx={connection:{rpc:{call:qualityRpc}},effect:f=>f(),on:()=>()=>{},locale:{register:(ns,d)=>Object.assign(dictionaries,d)},remote:{$on:()=>()=>{},session:{modelCatalog:async()=>({ok:true,value:clone(modelCatalog)})},workspaceFiles:{readBytes:async(id,file)=>{const r=Object.values(snapshots).concat(Object.values(currentReports)).find(x=>x.path===file);return r?.status==='ready'?{ok:true,value:{data:new TextEncoder().encode(JSON.stringify(r.value)),eof:true}}:{ok:false,error:{code:'ENOENT',message:'File not found'}}}}},configForms:{get:()=>modelScope,whileServed:(ns,f)=>f()},slots:{inject:(name,f)=>f(),register:(def,component)=>{components[def.id||def.key]={def,component};return()=>{}}},uiWorkspace:{openSession:address=>{document.getElementById('opened-status').textContent='模拟打开子 agent：'+address.childSessionId}},sidebarRight:{isExpanded:()=>true,openTab:()=>{}},sidebarRightTabs:{register:()=>()=>{}},sessions:{binding:id=>sessions.get(id),retain:address=>({ready:Promise.resolve(sessions.get(address.childSessionId)),release:()=>{}})},uiConversation:{binding:binding=>({target:()=>binding.chat})}};plugin.apply(ctx);
const view=ReactDOM.createRoot(document.getElementById('root')),at=new Date('2026-10-07T03:20:00Z').getTime();const descriptions={surveyor:'确认构建与质量规则',specifier:'25 条验收场景与需求约束',coder:'实现搜索解析和筛选面板',cleaner:'降低函数复杂度与 CRAP',hardener:'补测试并杀死变异体',qa:'真实构建逐条验证',reporter:'整理最终证据包'};
const pass=stage=>'GAUNTLET-RESULT: PASS\nstage: '+stage+'\nprofile: '+stage+'\nbranch: gauntlet/search-filters @ 3ab42f1\ngates: build ✅; tests ✅ (25/25)\nloop: rounds=2 distance=3 -> 0\nsummary: '+descriptions[stage]+'已完成，阶段闸门通过。\nnext: 继续下一阶段。';
function node(stage,id,output,running=false,index=0){const argsRaw=JSON.stringify({description:descriptions[stage],prompt:'需求：实现搜索筛选，保留旧接口。\n阶段：'+stage+'\n阅读 GAUNTLET.md 和全部 25 条验收场景。完整记录命令和检查结果，未通过的闸门逐项修复。'}),meta={address:{parentSessionId:sessionId,childSessionId:'child-'+id,mode:'one-shot'}};return{key:id,visibility:'visible',kind:'tool-call',data:{root:running?{phase:'start',callId:id,name:'gauntlet_'+stage,argsRaw,time:at+index*60000,meta,subCalls:[]}:{kind:'tool-result',callId:id,call:{name:'gauntlet_'+stage,argsRaw},content:[{type:'text',text:output}],isError:output.startsWith('Error:'),time:at+index*60000+50000,callTime:at+index*60000,meta,subCalls:[]}}}}
function reportsFor(complete=false){const ready=(path,value)=>({path,status:'ready',value}),missing=path=>({path,status:'missing',error:'尚未生成此报告'});const r={config:ready('gauntlet.config.json',{outDir:'gauntlet-out',paths:{qa:'qa'},thresholds:{crapMax:8,complexityMax:10,lineCoverageMin:.9,mutationScoreMin:1,functionLinesMax:60,nestingMax:4,paramsMax:7}}),local:missing('gauntlet.local.json')};const f=[{name:'parseSearchQuery',file:'src/search/parser.ts',line:18,endLine:52,complexity:7,coverage:.92,crap:7.025088,calls:84,violations:[]},{name:'renderFilters',file:'src/ui/filters.tsx',line:61,endLine:101,complexity:complete?6:10,coverage:complete?1:.6,crap:complete?6:16.4,calls:12,violations:complete?[]:['CRAP 16.4 > 8；函数覆盖率 60%']},{name:'validateQuery',file:'src/search/parser.ts',line:114,endLine:136,complexity:3,coverage:1,crap:3,calls:122,violations:[]}];
r.crap=ready('gauntlet-out/crap.json',{pass:complete,coverageSource:'istanbul / production',thresholds:{crapMax:8,lineCoverageMin:.9},functions:f,summary:{functions:3,maxCrap:complete?7.025088:16.4,maxComplexity:complete?7:10,offenders:complete?0:1,lineCoverage:complete?.97:.84,linesTotal:83,linesCovered:complete?81:70}});r.static=ready('gauntlet-out/static.json',{engine:'typescript-ast',thresholds:{complexityMax:10,functionLinesMax:60,nestingMax:4,paramsMax:7},functions:f.map((x,i)=>({name:x.name,file:x.file,line:x.line,endLine:x.endLine,complexity:x.complexity,lines:[35,41,23][i],nesting:[3,4,2][i],params:[2,3,1][i],accepted:false,violations:[]})),summary:{productionFiles:2,functions:3,maxComplexity:complete?7:10,maxLines:41,maxNesting:4,maxParams:3,offenders:0,warnings:0,codeLines:83},files:[{file:'src/search/parser.ts',parsed:true},{file:'src/ui/filters.tsx',parsed:true}],warnings:[]});
const mutants=[{file:'src/search/parser.ts',line:25,col:8,op:'boundary',original:'limit > 0',replacement:'limit >= 0',status:'KILLED'},{file:'src/search/parser.ts',line:37,col:4,op:'return',original:'return tokens',replacement:'return []',status:'TIMEOUT'},{file:'src/ui/filters.tsx',line:69,col:7,op:'negate',original:'isVisible',replacement:'!isVisible',status:complete?'KILLED':'SURVIVED',reason:complete?'Regression caught':'Missing hidden-filter assertion'},{file:'src/ui/filters.tsx',line:88,col:2,op:'condition',original:'query.length > 0',replacement:'true',status:complete?'KILLED':'NO_COVERAGE'},{file:'src/search/parser.ts',line:119,col:3,op:'boundary',original:'query.length <= 120',replacement:'query.length < 120',status:'KILLED'},{file:'src/search/parser.ts',line:400,col:1,op:'literal',original:'null',replacement:'undefined',status:'COMPILE_ERROR'},{file:'src/search/parser.ts',line:130,col:8,op:'equivalent',original:'x + 0',replacement:'x',status:'ACCEPTED',reason:'Equivalent by arithmetic identity'}];r.mutation=ready('gauntlet-out/mutation.json',{tool:'mutation adapter',threshold:1,score:complete?1:.6,pass:complete,scope:{mode:'all',files:2},results:mutants,summary:{total:7,killed:complete?5:3,survived:complete?0:1,noCoverage:complete?0:1,compileErrors:1,accepted:1,candidates:7}});
r.tests=ready('gauntlet-out/tests.json',{total:25,passed:complete?25:24,failed:complete?0:1,cases:[{title:'empty query preserves default filters',status:complete?'passed':'failed',file:'tests/search.test.ts',durationMs:4,output:complete?'PASS':'Expected 4 filters, received 0'},{title:'legacy API is compatible',status:'passed',durationMs:7},{title:'query maximum length',status:'passed',durationMs:2}]});r.survey=ready('gauntlet-out/survey.json',{adapter:'commands',languages:['TypeScript'],buildCommand:'npm run build',testCommand:'npm test',tools:{node:'22.18.0',vitest:'3.0.5'},productionFiles:2});r.constraints=ready('qa/constraints.json',{constraints:[{id:'C1',text:'空查询必须显示全部筛选项'},{id:'C2',text:'保留旧接口行为'},{id:'C3',text:'保留完整质量与变异体报告'}]});r.qa=complete?ready('qa/qa-report.json',{verdict:'pass',summary:'真实浏览器逐条验证通过；旧接口行为一致。',environment:{os:'Windows 11',browser:'Chrome'},checks:[{id:'QA1',title:'空查询保留全部筛选项',action:'清空搜索输入',expected:'显示全部筛选项',actual:'全部 4 项均显示',status:'pass',constraint:'C1'},{id:'QA2',title:'旧接口兼容',action:'运行原调用方回归',expected:'格式不变',actual:'回归通过',status:'pass',constraint:'C2'}]}):missing('qa/qa-report.json');
['Specifier','Coder','Cleaner','Hardener','Full','Quality'].forEach(profile=>{r['loop'+profile]=ready('gauntlet-out/loop-'+profile.toLowerCase()+'.json',{rounds:[{at:'2026-10-07T03:20:00Z',commit:{short:'f72a19b'},remaining:3,distance:5.5,failing:['tests','crap','mutation'],improved:true,verdict:'CONTINUE'},{at:'2026-10-07T03:27:00Z',commit:{short:'3ab42f1'},remaining:complete?0:1,distance:complete?0:1,failing:complete?[]:['tests'],improved:true,verdict:complete?'DONE':'CONTINUE'}]})});r.gate=ready('gauntlet-out/gate.json',{profile:complete?'full':'coder',title:'Search filters',pass:complete,startedAt:'2026-10-07T03:20:00Z',finishedAt:'2026-10-07T03:27:00Z',commit:{short:'3ab42f1',branch:'gauntlet/search-filters'},gates:{build:{pass:true,ran:true,command:'npm run build'},tests:{pass:complete,ran:true,total:25,passed:complete?25:24},crap:{pass:complete,ran:true,max:complete?7.025088:16.4,threshold:8},mutation:{pass:complete,ran:true,score:complete?1:.6,threshold:1},qa:{pass:complete,ran:complete,skipped:!complete,reason:complete?'All constraints verified':'QA has not run'}}});r.loop={...r[complete?'loopFull':'loopCoder'],profile:complete?'full':'coder'};return r}
function activityNodes(id,running){const tool=(suffix,name,args,output,time,active=false)=>({key:id+suffix,kind:'tool-call',visibility:'visible',data:{root:active?{callId:id+suffix,name,argsRaw:JSON.stringify(args),phase:'start',time,subCalls:[]}:{kind:'tool-result',callId:id+suffix,call:{name,argsRaw:JSON.stringify(args)},callTime:time,time:time+1700,content:[{type:'text',text:output}],subCalls:[]}}});return[{key:id+'-user',kind:'user',visibility:'visible',data:{content:'按完整规格实现搜索筛选，保留旧接口。完整记录验收场景与函数质量报告。',time:at}},tool('-read','read_file',{path:'GAUNTLET.md'},'# Project profile\nTypeScript / React\nBuild: npm run build\nTests: npm test\nCRAP ≤ 8; Mutation score = 100%',at+1000),{key:id+'-plan',kind:'assistant-step',visibility:'visible',data:{blocks:[{kind:'text',text:'已阅读 25 条验收场景。先新增空查询和旧接口测试，再修改搜索解析器与筛选组件。'}],time:at+4000}},tool('-search','rg',{command:'rg -n "parseSearchQuery|renderFilters" src tests'},'src/search/parser.ts:18:parseSearchQuery\nsrc/ui/filters.tsx:61:renderFilters\ntests/search.test.ts:12:empty query preserves default filters',at+6000),tool('-edit','apply_patch',{files:['src/search/parser.ts','src/ui/filters.tsx','tests/search.test.ts'],patch:'Add normalization and visibility logic.'},'3 files changed, 68 insertions(+), 12 deletions(-)',at+10000),tool('-test','shell',{command:'npm test -- --runInBand'},'PASS parser.test.ts (18 tests)\nPASS legacy-api.test.ts (6 tests)\nFAIL search.test.ts\n  Expected 4 filters, received 0\nTests: 24 passed, 1 failed, 25 total\nTime: 2.381s',at+15000),{key:id+'-finding',kind:'assistant-step',visibility:'visible',data:{blocks:[{kind:'text',text:'空查询被误判为“无匹配结果”，正在修复过滤分支。renderFilters 的 CRAP 为 16.4；清理阶段需要拆分函数并补齐覆盖。'}],time:at+19000}},tool('-quality','shell',{command:'node .gauntlet/gauntlet.mjs crap'},'3 functions measured\nparseSearchQuery: CRAP 7.03, coverage 92%\nrenderFilters: CRAP 16.40, coverage 60%, above threshold 8\nvalidateQuery: CRAP 3.00, coverage 100%\nReport: gauntlet-out/crap.json',at+21000),tool('-rerun','shell',{command:'npm test -- tests/search.test.ts'},running?'':'PASS empty query preserves default filters\n25 / 25 tests passed',at+23000,running)]}
const loadReports=async signal=>{const loaded=qualityLoaded(sessionId);return {...currentReports,config:{path:'gauntlet.config.json',status:'ready',value:{...loaded.base,thresholds:loaded.values},committed:loaded.base,localOverrides:true},local:{path:'gauntlet.local.json',status:'ready',value:loaded.local}}},loadSnapshot=async(id,signal)=>snapshots[id]||{path:'gauntlet-out/workflow/'+encodeURIComponent(id).replace(/\./g,'%2E')+'/reports.json',status:'missing',error:'运行中的阶段尚未生成完成快照'};
function observeActivity(address,onState){let disposed=false,older=false;const id=address.childSessionId.replace(/^child-/,''),running=snapshots[id]?.status!=='ready'&&['live','retry'].includes(scenario),nodes=activityNodes(id,running);const publish=(loadingOlder=false)=>{if(disposed)return;const activity=plugin.buildStageActivity(nodes);if(older){activity.entries.unshift({id:id+'-older',kind:'assistant',text:'前置检查：工作目录、Git 分支和规则文件均已确认。后续全部操作记录到本次子 agent 会话。',time:at-60000});activity.messageCount++}onState({status:'ready',activity,hasMore:!older,loadingOlder,running})};onState({status:'loading',activity:{entries:[],toolCount:0,messageCount:0},hasMore:false,loadingOlder:false,running});const timer=setTimeout(()=>publish(),80);return{dispose:()=>{disposed=true;clearTimeout(timer)},loadOlder:async()=>{publish(true);older=true;publish(false)}}}
function render(){sessionId='preview-'+scenario;window.__gauntletPreview.currentSessionId=sessionId;let nodes=keys.slice(0,2).map((k,i)=>node(k,'n'+i,pass(k),false,i)),running=true,todos=null,preset='gauntlet',subagent=null;
if(scenario==='live')nodes.push(node('coder','n2','',true,2));if(scenario==='retry'){nodes=keys.slice(0,5).map((k,i)=>node(k,'n'+i,pass(k),false,i));nodes.push(node('coder','n5','GAUNTLET-RESULT: FAIL\nstage: coder\ngates: tests ❌ (24/25)\nsummary: 空查询边界场景失败，正在修复。\nloop: rounds=1 distance=1 -> 1',false,5));nodes.push(node('coder','n6','',true,6))}if(scenario==='waiting'||scenario==='wait'){nodes=[node('surveyor','n0',pass('surveyor'),false,0)];running=false;todos=[{content:'surveyor · 摸底 — 等待确认：请确认构建命令和质量规则',status:'in_progress'}]}if(scenario==='interrupted'){nodes.push(node('coder','n2','Error: cancelled',false,2));running=false}if(scenario==='complete'){nodes=keys.map((k,i)=>node(k,'n'+i,pass(k),false,i));running=false}if(scenario==='empty'){nodes=[];running=false}if(scenario==='standard')preset='standard';if(scenario==='child')subagent={address:{mode:'one-shot'}};
currentReports=reportsFor(scenario==='complete');if(scenario==='empty')currentReports=Object.fromEntries(Object.entries(currentReports).map(([key,value])=>[key,{path:value.path,status:'missing',error:'工作区还没有报告'}]));snapshots={};nodes.forEach(n=>{const r=n.data.root,stage=(r.call?.name||r.name).slice(9),id='child-'+r.callId,records=activityNodes(r.callId,r.kind!=='tool-result');const chat=store({order:records.map(x=>x.key),nodes:new Map(records.map(x=>[x.key,x]))}),state=store({running:r.kind!=='tool-result',hasMore:true,loadingOlder:false});state.loadOlder=async()=>{};sessions.set(id,{sessionId:id,session:state,eventSource:store({entries:[],revision:1}),chat});if(r.kind!=='tool-result')return;const reports=reportsFor(scenario==='complete'||keys.indexOf(stage)>=3);if(keys.indexOf(stage)<2)for(const key of Object.keys(reports))if(!['config','local','survey','constraints','tests'].includes(key))reports[key]={path:reports[key].path,status:'missing',error:'此阶段还未产生该类测量'};snapshots[r.callId]={path:'gauntlet-out/workflow/'+r.callId+'/reports.json',status:'ready',value:{version:1,callId:r.callId,stageKey:stage,toolName:'gauntlet_'+stage,parentSessionId:sessionId,childSessionId:id,capturedAt:r.time,output:r.content[0].text,isError:r.isError,prompt:JSON.parse(r.call.argsRaw).prompt,reports}}});
const chat={order:nodes.map(n=>n.key),nodes:new Map(nodes.map(n=>[n.key,n]))},session={running,subagent,hasMore:false,loadingOlder:false},entry=components['@dsh-crap-agents/gauntlet-progress'];if(!entry)throw new Error('Actual right-panel component not registered');const modelFace=components['dsh-gauntlet'].def.inject(),injected={...modelFace,...entry.def.inject(sessionId)};view.render(h(entry.component,{...injected,useGauntletCard:select=>select(React.useSyncExternalStore(injected.hooks.gauntletCard.subscribe,injected.hooks.gauntletCard.getSnapshot,injected.hooks.gauntletCard.getSnapshot)),sessionId,t:key=>dictionaries[locale][key]||key,useSessions:select=>select({byId:{[sessionId]:{projectionValues:{agentPreset:preset}}}}),useChat:select=>select(chat),useSession:select=>select(session),useProjection:key=>key==='todos'?todos:key==='subagentCatalog'?nodes.map(n=>({id:'child-'+n.data.root.callId,label:descriptions[(n.data.root.call?.name||n.data.root.name).slice(9)],mode:'one-shot',createdAt:n.data.root.callTime||n.data.root.time})):null,loadReports,loadSnapshot,observeActivity}));document.getElementById('leader-status').textContent=running?'深度求索中 · 子 agent 正在执行任务…':scenario==='complete'?'七阶段均已通过 · 证据包已就绪':scenario==='waiting'?'等待确认 · 请审阅摸底配置与规则':'当前模拟状态：'+scenario}
document.getElementById('scenario').onchange=e=>{scenario=e.target.value;render()};document.getElementById('locale').onchange=e=>{locale=e.target.value;render()};document.getElementById('dark').onchange=e=>document.body.classList.toggle('dark',e.target.checked);document.getElementById('mobile').onclick=()=>{const iframe=document.createElement('iframe');iframe.src='/?narrow';iframe.style='position:fixed;inset:0 auto 0 0;width:390px;height:100vh;border:0;background:white;z-index:40';document.body.append(iframe);const close=document.createElement('button');close.textContent='× 返回';close.style='position:fixed;top:4px;right:4px;z-index:41';close.onclick=()=>{iframe.remove();close.remove()};document.body.append(close)};if(location.search.includes('narrow'))document.getElementById('mobile').hidden=true;render();
</script></body></html>`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/client.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(req.url==='/client.js'?fs.readFileSync(path.join(root,'lib/client.js')):html)});
server.listen(3091,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:3091 · synthetic data'));



