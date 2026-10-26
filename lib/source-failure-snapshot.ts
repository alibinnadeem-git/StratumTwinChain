/** A rejected source must not run model enrichment or replace a successful source revision. */
export function withFailedImportSource<T extends {sources:unknown[];stats?:Record<string,unknown>}>(
 graph:T,failedSource:{sha256:string;state:'failed';[key:string]:unknown},
):T{
 const index=graph.sources.findIndex(value=>value!==null&&typeof value==='object'&&
  (value as {sha256?:unknown}).sha256===failedSource.sha256);
 const previous=index<0?null:graph.sources[index] as {state?:unknown};
 // A failed reprocess (or a stale failure racing with success) cannot replace the good source.
 if(previous&&previous.state!=='failed')return graph;
 const sources=[...graph.sources];
 if(index<0)sources.push(failedSource);else sources[index]=failedSource;
 return{...graph,sources,...(graph.stats?{stats:{...graph.stats,L0:sources.length}}:{})};
}
