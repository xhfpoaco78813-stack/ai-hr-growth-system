let pending=null,inflight=null,saveTimer=null,retryDelay=1000,learningQueue=[];
function status(s){const e=document.getElementById('syncStatus');if(e)e.textContent=s}
function schedule(delay=500){clearTimeout(saveTimer);saveTimer=setTimeout(()=>flushProgress().catch(()=>{}),delay)}
window.hrSync=function(state){if(!token)return;pending={owner:token,state:JSON.stringify(state),revision:contentRevision};schedule()};
window.flushProgress=async function(){
 if(inflight){await inflight;if(pending)return flushProgress();return}
 if(!pending||!token)return;
 const item=pending;pending=null;if(item.owner!==token)return;
 inflight=(async()=>{try{await api('progress','PUT',{state:JSON.parse(item.state),contentRevision:item.revision});retryDelay=1000;if(token===item.owner)status('✓ 已保存')}catch(e){if(token===item.owner&&!pending)pending=item;status('暂未保存，将自动重试');schedule(retryDelay);retryDelay=Math.min(30000,retryDelay*2);throw e}})();
 try{await inflight}finally{inflight=null}
 if(pending)return flushProgress();
};
async function openApp(){pending=null;clearTimeout(saveTimer);const owner=token;const [c,s,e,p]=await Promise.all([api('content'),api('progress'),api('exam'),api('profile')]);if(owner!==token)return;contentRevision=c.revision;window.hrBridge.load(c.content,s,e.exam,p.profile);bar();document.querySelector('.app').hidden=false;window.hrBridge.home()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushProgress().catch(()=>{})});window.addEventListener('beforeunload',e=>{if(pending||inflight){e.preventDefault();e.returnValue='学习记录仍在保存'}});
async function flushLearning(){const queue=learningQueue.slice();learningQueue=[];for(const payload of queue)try{await api('learning','POST',payload)}catch{learningQueue.push(payload)}if(learningQueue.length)throw Error('仍有作答记录尚未保存')}
window.flushLearning=flushLearning;
window.addEventListener('online',()=>{status('网络已恢复，正在保存');schedule(0);flushLearning()});
window.hrCreateExam=async settings=>(await api('exam','POST',Object.assign({action:'start'},settings))).exam;
window.hrSaveExam=function(q){const payload={action:'save',id:q.id,picks:{...q.picks},sequence:q.sequence=(q.sequence||0)+1};const send=n=>api('exam','POST',payload).catch(e=>{if(n<3&&token){status('考试答案保存重试中');return new Promise(resolve=>setTimeout(resolve,500*Math.pow(2,n))).then(()=>send(n+1))}status('考试答案暂未保存，交卷时会再次提交全部答案');throw e});send(0).catch(()=>{})};
window.hrSubmitExam=q=>api('exam','POST',{action:'submit',id:q.id,picks:q.picks,sequence:q.sequence=(q.sequence||0)+1});
window.hrSaveProfile=data=>api('profile','PUT',data).then(x=>x.profile);
window.hrRecord=(q,pick)=>{const payload={action:'answer',eventId:q.id+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),questionId:q.id,pick};const send=n=>api('learning','POST',payload).then(x=>x.progress).catch(e=>n<3&&token?new Promise(resolve=>setTimeout(resolve,500*Math.pow(2,n))).then(()=>send(n+1)):(learningQueue.push(payload),Promise.reject(e)));return send(0)};
window.hrCompleteLesson=lesson=>api('learning','POST',{action:'complete',sessionId:lesson.sessionId,results:lesson.results,title:lesson.title}).then(x=>x.progress);
boot();

