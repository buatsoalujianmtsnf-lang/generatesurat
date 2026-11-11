/** MON-09 read-only report. Never prints Redis credentials or individual data. */
import {createMon09RedisCommand, monitoringEnabled, mon09Config, summarizeMon09} from '../api/mon09-metrics.js';
const args=process.argv.slice(2);
const live=args.includes('--live');
const match=args.find(x=>/^--days=/.test(x));
const days=match?Number(match.slice(7)):7;
function output(value) {console.log(JSON.stringify(value,null,2));}
if (!Number.isInteger(days)||days<1||days>14){
  console.error('MON-09: --days must be between 1 and 14');
  process.exitCode=2;
} else if(!live){
  output({stage:'MON-09',status:'NOT_QUERIED',productionObserved:false,
    monitoringConfigured:monitoringEnabled(),
    note:'No production metric query by default. Use --live only after approved rollout and credentials are configured.'});
}else if(!monitoringEnabled()){
  output({stage:'MON-09',status:'MONITORING_DISABLED',productionObserved:false,
    note:'Metrics require two explicit flags and Redis credentials. This is not an uptime assessment.'});
  process.exitCode=2;
}else {
  const date=new Date();
  const query=createMon09RedisCommand();
  const readings=[];
  try {
    for(let i=days-1;i>=0;i--){
      const day=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-i))
        .toISOString().slice(0,10);
      readings.push({day,values:await query(['HGETALL','gs:mon09:v1:'+day])});
    }
    const result=summarizeMon09(readings);
    output({...result,environment:'Redis aggregate only',productionObserved:true});
    if(result.status==='ALERT')process.exitCode=3;
  }catch{
    output({stage:'MON-09',status:'METRICS_UNAVAILABLE',productionObserved:false,
      note:'Redis could not be read. No assumptions about production health.'});
    process.exitCode=2;
  }
}
