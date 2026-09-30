import React,{useEffect,useState}from"react";
import{Check,Clock,MapPin,RefreshCw,X}from"lucide-react";
import{supabase}from"../../../lib/supabase";

type Picker={id:string;full_name:string;phone:string;city:string;locality:string|null;pincode:string|null;latitude:number|null;longitude:number|null;availability_status:string;application_status:string;created_at:string};

export function Pickers(){
 const[rows,setRows]=useState<Picker[]>([]);const[filter,setFilter]=useState("pending");const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);
 const load=async()=>{setLoading(true);setError(null);const{data,error}=await supabase.from("picker_profiles").select("id,full_name,phone,city,locality,pincode,latitude,longitude,availability_status,application_status,created_at").order("created_at",{ascending:false});if(error)setError(error.message);else setRows((data||[]) as Picker[]);setLoading(false)};
 useEffect(()=>{load()},[]);
 const update=async(id:string,status:"approved"|"rejected"|"suspended")=>{const{error}=await supabase.from("picker_profiles").update({application_status:status,updated_at:new Date().toISOString()}).eq("id",id);if(error){setError(error.message);return}await load()};
 const filtered=filter==="all"?rows:rows.filter(p=>p.application_status===filter);
 return <div className="space-y-5"><div className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-[#0F172A]">RivoCity Pickers</h1><p className="text-xs text-[#64748B] mt-1">Review Picker registrations and control approval status.</p></div><button onClick={load} className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Refresh</button></div>
 <div className="flex gap-2">{["pending","approved","rejected","suspended","all"].map(v=><button key={v} onClick={()=>setFilter(v)} className={"px-3 py-2 rounded-lg text-xs font-semibold capitalize "+(filter===v?"bg-[#22C55E] text-white":"bg-white border border-[#E2E8F0] text-[#64748B]")}>{v}</button>)}</div>
 {error&&<div className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-xs">{error}</div>}
 {loading?<div className="py-16 flex justify-center"><RefreshCw className="animate-spin text-[#22C55E]"/></div>:filtered.length===0?<div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-xs text-[#94A3B8]">No Picker registrations in this view.</div>:<div className="grid gap-3">{filtered.map(p=><div key={p.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-sm text-[#0F172A]">{p.full_name}</h2><p className="text-xs text-[#64748B] mt-1">{p.phone} · {p.city}{p.locality?" · "+p.locality:""}</p><p className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-1"><MapPin className="w-3 h-3"/>{p.pincode||"Pincode not provided"} · {p.availability_status}</p></div><span className={"text-[10px] font-bold px-2 py-1 rounded-full "+(p.application_status==="approved"?"bg-green-50 text-green-700":p.application_status==="pending"?"bg-amber-50 text-amber-700":"bg-red-50 text-red-700")}>{p.application_status}</span></div>
 {p.application_status==="pending"&&<div className="flex gap-2 mt-4"><button onClick={()=>update(p.id,"approved")} className="flex-1 rounded-lg bg-[#22C55E] text-white py-2 text-xs font-bold flex items-center justify-center gap-1"><Check className="w-4 h-4"/>Approve</button><button onClick={()=>update(p.id,"rejected")} className="flex-1 rounded-lg border border-[#E2E8F0] text-red-600 py-2 text-xs font-bold flex items-center justify-center gap-1"><X className="w-4 h-4"/>Reject</button></div>}
 {p.application_status==="approved"&&<button onClick={()=>update(p.id,"suspended")} className="mt-4 rounded-lg border border-[#E2E8F0] text-red-600 px-3 py-2 text-xs font-bold">Suspend Picker</button>}
 {p.application_status==="suspended"&&<button onClick={()=>update(p.id,"approved")} className="mt-4 rounded-lg bg-[#22C55E] text-white px-3 py-2 text-xs font-bold">Re-approve</button>}
 </div>)}</div>}
 </div>
}