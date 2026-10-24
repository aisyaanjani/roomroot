import type { Layout } from './model'
export const HISTORY_LIMIT = 60
export interface History { present: Layout; past: Layout[]; future: Layout[]; transaction?: Layout }
export type HistoryAction = {type:'update'; value:Layout|((layout:Layout)=>Layout)} | {type:'begin'|'end'|'undo'|'redo'}
export const initialHistory=(present:Layout):History=>({present,past:[],future:[]})
const equal=(a:Layout,b:Layout)=>a===b||JSON.stringify(a)===JSON.stringify(b)
export function historyReducer(state:History,action:HistoryAction):History {
  switch(action.type){
    case 'begin': return state.transaction?state:{...state,transaction:state.present}
    case 'end': {
      if(!state.transaction)return state
      const {transaction,...rest}=state
      return equal(transaction,state.present)?rest:{...rest,past:[...state.past,transaction].slice(-HISTORY_LIMIT),future:[]}
    }
    case 'update': {
      const next=typeof action.value==='function'?action.value(state.present):action.value
      if(equal(next,state.present))return state
      return {...state,present:next,past:state.transaction?state.past:[...state.past,state.present].slice(-HISTORY_LIMIT),future:[]}
    }
    case 'undo': {
      if(state.transaction||!state.past.length)return state
      return {present:state.past[state.past.length-1]!,past:state.past.slice(0,-1),future:[state.present,...state.future].slice(0,HISTORY_LIMIT)}
    }
    case 'redo': {
      if(state.transaction||!state.future.length)return state
      return {present:state.future[0]!,past:[...state.past,state.present].slice(-HISTORY_LIMIT),future:state.future.slice(1)}
    }
  }
}
