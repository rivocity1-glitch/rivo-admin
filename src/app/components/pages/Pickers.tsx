import React,{useEffect,useState}from"react";
import{Check,Clock,MapPin,RefreshCw,X,Eye,Building2,LifeBuoy}from"lucide-react";
import{supabase}from"../../../lib/supabase";

type Picker={
 id:string;auth_user_id:string;picker_login_id:string|null;email:string|null;full_name:string;phone:string;
 city:string;locality:string|null;pincode:string|null;latitude:number|null;longitude:number|null;
 availability_status:string;application_status:string;registration_source:string|null;created_by_vendor_id:string|null;created_at:string;updated_at:string|null;address:string|null;documents_submitted:any;
};
type HelperRequest={id:string;vendor_id:string;title:string;description:string;status:string;priority:string;created_at:string;};
type VendorOption={id:string;shop_name:string};
type LaneOption={id:string;vendor_id:string;lane_name:string};

export function Pickers(){
 const[rows,setRows]=useState<Picker[]>([]);const[vendorNames,setVendorNames]=useState<Record<string,string>>({});const[allVendors,setAllVendors]=useState<VendorOption[]>([]);const[allLanes,setAllLanes]=useState<LaneOption[]>([]);const[manualVendor,setManualVendor]=useState("");const[manualPicker,setManualPicker]=useState("");const[manualLane,setManualLane]=useState("");const[manualAssigning,setManualAssigning]=useState(false);const[helperRequests,setHelperRequests]=useState<HelperRequest[]>([]);const[helperVendors,setHelperVendors]=useState<Record<string,string>>({});const[helperPickers,setHelperPickers]=useState<Picker[]>([]);const[helperLanes,setHelperLanes]=useState<Record<string,{id:string;lane_name:string}[]>>({});const[selectedPicker,setSelectedPicker]=useState<Record<string,string>>({});const[selectedLane,setSelectedLane]=useState<Record<string,string>>({});const[assigningHelper,setAssigningHelper]=useState<string|null>(null);
 const[filter,setFilter]=useState("pending");const[selected,setSelected]=useState<Picker|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState<string|null>(null);

 const load=async()=>{
  setLoading(true);setError(null);
  const{data,error}=await supabase.from("picker_profiles").select("id,auth_user_id,picker_login_id,email,full_name,phone,city,locality,pincode,latitude,longitude,availability_status,application_status,registration_source,created_by_vendor_id,address,documents_submitted,created_at,updated_at").order("created_at",{ascending:false});
  if(error){setError(error.message);setLoading(false);return}
  const pickers=(data||[]) as Picker[];setRows(pickers);
  const vendorIds=[...new Set(pickers.map(p=>p.created_by_vendor_id).filter(Boolean))] as string[];
  if(vendorIds.length){const{data:vendors,error:ve}=await supabase.from("vendors").select("id,shop_name").in("id",vendorIds);if(!ve)setVendorNames(Object.fromEntries((vendors||[]).map((v:any)=>[v.id,v.shop_name||"Vendor"])));}
  const{data:allVendorData}=await supabase.from("vendors").select("id,shop_name").order("shop_name");setAllVendors((allVendorData||[]) as VendorOption[]);
  const{data:allLaneData}=await supabase.from("vendor_lanes").select("id,vendor_id,lane_name").eq("status","active").order("lane_name");setAllLanes((allLaneData||[]) as LaneOption[]);
  const{data:helperData,error:helperError}=await supabase.from("vendor_support_tickets").select("id,vendor_id,title,description,status,priority,issue_type,created_at").eq("issue_type","picker_helper").in("status",["open","in_progress"]).order("created_at",{ascending:false});
  if(helperError)console.error("Picker helper queue load failed:",helperError);
  const helpers=(helperData||[]) as HelperRequest[];setHelperRequests(helpers);
  const helperVendorIds=[...new Set(helpers.map(h=>h.vendor_id))];
  if(helperVendorIds.length){const{data:hv}=await supabase.from("vendors").select("id,shop_name").in("id",helperVendorIds);setHelperVendors(Object.fromEntries((hv||[]).map((v:any)=>[v.id,v.shop_name||"Vendor"])));const{data:hl}=await supabase.from("vendor_lanes").select("id,vendor_id,lane_name").in("vendor_id",helperVendorIds).eq("status","active");const grouped:Record<string,{id:string;lane_name:string}[]>={};(hl||[]).forEach((l:any)=>{(grouped[l.vendor_id] ||= []).push({id:l.id,lane_name:l.lane_name})});setHelperLanes(grouped);}
  setHelperPickers(pickers.filter(p=>p.application_status==="approved"));
  setLoading(false);
 };
 useEffect(()=>{load()},[]);

 const update=async(id:string,status:"approved"|"rejected"|"suspended")=>{
  const{error}=await supabase.from("picker_profiles").update({application_status:status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){setError(error.message);return}await load();
  setSelected(prev=>prev?.id===id?{...prev,application_status:status}:prev);
 };
 const assignManualPicker=async()=>{
  if(!manualVendor||!manualPicker){setError("Select a vendor and approved Picker.");return;}
  setManualAssigning(true);setError(null);
  const{error}=await supabase.rpc("admin_assign_picker_helper",{p_vendor_id:manualVendor,p_picker_id:manualPicker,p_ticket_id:null,p_lane_id:manualLane||null});
  if(error){setError(error.message);setManualAssigning(false);return;}
  setManualPicker("");setManualLane("");await load();setManualAssigning(false);
 };
 const assignHelper=async(ticket:HelperRequest)=>{
  const pickerId=selectedPicker[ticket.id];
  if(!pickerId){setError("Select an approved Picker.");return;}
  setAssigningHelper(ticket.id);setError(null);
  const{error}=await supabase.rpc("admin_assign_picker_helper",{p_vendor_id:ticket.vendor_id,p_picker_id:pickerId,p_ticket_id:ticket.id,p_lane_id:selectedLane[ticket.id]||null});
  if(error){setError(error.message);setAssigningHelper(null);return;}
  await load();setAssigningHelper(null);
 };
 const filtered=filter==="all"?rows:rows.filter(p=>p.application_status===filter);

 return <div className="space-y-5">
  <div className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-[#0F172A]">RivoCity Pickers</h1><p className="text-xs text-[#64748B] mt-1">Review Picker applications, vendor-created Pickers and account details.</p></div><button onClick={load} className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Refresh</button></div>
  <div className="flex gap-2 flex-wrap">{["pending","approved","rejected","suspended","all"].map(v=><button key={v} onClick={()=>setFilter(v)} className={"px-3 py-2 rounded-lg text-xs font-semibold capitalize "+(filter===v?"bg-[#22C55E] text-white":"bg-white border border-[#E2E8F0] text-[#64748B]")}>{v}</button>)}</div>
  {error&&<div className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-xs">{error}</div>}
  <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
   <div><h2 className="font-bold text-sm">Assign Picker to Vendor</h2><p className="text-xs text-[#64748B] mt-1">Admin can assign any approved Picker to any vendor. Lane assignment is optional.</p></div>
   <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <select value={manualVendor} onChange={e=>{setManualVendor(e.target.value);setManualLane("")}} className="h-9 rounded-lg border px-3 text-xs bg-white"><option value="">Select vendor</option>{allVendors.map(v=><option key={v.id} value={v.id}>{v.shop_name||"Vendor"}</option>)}</select>
    <select value={manualPicker} onChange={e=>setManualPicker(e.target.value)} className="h-9 rounded-lg border px-3 text-xs bg-white"><option value="">Select approved Picker</option>{helperPickers.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.picker_login_id||"Picker"}</option>)}</select>
    <select value={manualLane} onChange={e=>setManualLane(e.target.value)} className="h-9 rounded-lg border px-3 text-xs bg-white"><option value="">Vendor-wide / no lane</option>{allLanes.filter(l=>l.vendor_id===manualVendor).map(l=><option key={l.id} value={l.id}>{l.lane_name}</option>)}</select>
    <button onClick={assignManualPicker} disabled={manualAssigning} className="h-9 rounded-lg bg-[#22C55E] text-white text-xs font-bold">{manualAssigning?"Assigning…":"Assign Picker"}</button>
   </div>
  </section>
  <section className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
   <div className="flex items-center justify-between"><div><h2 className="font-bold text-sm flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-emerald-600"/>Picker / Helper Requests</h2><p className="text-xs text-[#64748B] mt-1">Vendors request help here. Admin assigns an approved Picker to the vendor and optionally to a lane.</p></div><span className="text-xs font-bold text-amber-700">{helperRequests.length} open</span></div>
   {helperRequests.length===0?<div className="rounded-lg border bg-slate-50 p-4 text-xs text-[#64748B]">No open Picker/helper requests.</div>:<div className="space-y-3">{helperRequests.map(ticket=><div key={ticket.id} className="rounded-xl border border-[#E2E8F0] p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{helperVendors[ticket.vendor_id]||"Vendor"}</p><p className="text-xs text-[#64748B] mt-1">{ticket.description}</p></div><span className="text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 px-2 py-1">{ticket.status}</span></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
      <select value={selectedPicker[ticket.id]||""} onChange={e=>setSelectedPicker(v=>({...v,[ticket.id]:e.target.value}))} className="h-9 rounded-lg border px-3 text-xs bg-white"><option value="">Select approved Picker</option>{helperPickers.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.picker_login_id||"Picker"}</option>)}</select>
      <select value={selectedLane[ticket.id]||""} onChange={e=>setSelectedLane(v=>({...v,[ticket.id]:e.target.value}))} className="h-9 rounded-lg border px-3 text-xs bg-white"><option value="">Vendor-wide helper</option>{(helperLanes[ticket.vendor_id]||[]).map(l=><option key={l.id} value={l.id}>{l.lane_name}</option>)}</select>
      <button onClick={()=>assignHelper(ticket)} disabled={assigningHelper===ticket.id} className="h-9 rounded-lg bg-[#22C55E] text-white text-xs font-bold">{assigningHelper===ticket.id?"Assigning…":"Assign Picker / Helper"}</button>
    </div>
   </div>)}</div>}
  </section>
  {loading?<div className="py-16 flex justify-center"><RefreshCw className="animate-spin text-[#22C55E]"/></div>:filtered.length===0?<div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-xs text-[#94A3B8]">No Picker registrations in this view.</div>:
  <div className="grid gap-3">{filtered.map(p=><div key={p.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
   <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="font-bold text-sm text-[#0F172A]">{p.full_name}</h2><p className="text-xs text-emerald-700 font-bold mt-1">{p.picker_login_id||"Picker ID pending"}</p><p className="text-xs text-[#64748B] mt-1">{p.email||"No email"} · {p.phone} · {p.city}{p.locality?" · "+p.locality:""}</p><p className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-1"><MapPin className="w-3 h-3"/>{p.pincode||"Pincode not provided"} · {p.availability_status}</p></div><div className="flex flex-col items-end gap-2"><span className={"text-[10px] font-bold px-2 py-1 rounded-full "+(p.application_status==="approved"?"bg-green-50 text-green-700":p.application_status==="pending"?"bg-amber-50 text-amber-700":"bg-red-50 text-red-700")}>{p.application_status}</span><span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">{p.registration_source==="vendor"?"Vendor Created":"PWA Application"}</span></div></div>
   {p.registration_source==="vendor"&&<p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1"><Building2 className="w-3 h-3"/>Created by {vendorNames[p.created_by_vendor_id||""]||"Vendor"}</p>}
   <div className="flex gap-2 mt-4"><button onClick={()=>setSelected(p)} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-bold flex items-center gap-1"><Eye className="w-4 h-4"/>View Details</button>{p.application_status==="pending"&&<><button onClick={()=>update(p.id,"approved")} className="flex-1 rounded-lg bg-[#22C55E] text-white py-2 text-xs font-bold flex items-center justify-center gap-1"><Check className="w-4 h-4"/>Approve</button><button onClick={()=>update(p.id,"rejected")} className="flex-1 rounded-lg border border-[#E2E8F0] text-red-600 py-2 text-xs font-bold flex items-center justify-center gap-1"><X className="w-4 h-4"/>Reject</button></>}{p.application_status==="approved"&&<button onClick={()=>update(p.id,"suspended")} className="rounded-lg border border-[#E2E8F0] text-red-600 px-3 py-2 text-xs font-bold">Suspend</button>}{p.application_status==="suspended"&&<button onClick={()=>update(p.id,"approved")} className="rounded-lg bg-[#22C55E] text-white px-3 py-2 text-xs font-bold">Re-approve</button>}</div>
  </div>)}</div>}
  {selected&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={()=>setSelected(null)}><div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border shadow-xl p-6" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">{selected.full_name}</h2><p className="text-xs text-emerald-700 font-bold">{selected.picker_login_id||"No Picker ID"}</p></div><button onClick={()=>setSelected(null)}><X/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">{[["Email",selected.email||"—"],["Phone",selected.phone||"—"],["Auth User ID",selected.auth_user_id],["City",selected.city||"—"],["Locality",selected.locality||"—"],["Pincode",selected.pincode||"—"],["Address",selected.address||"—"],["Latitude",selected.latitude??"—"],["Longitude",selected.longitude??"—"],["Availability",selected.availability_status],["Application",selected.application_status],["Source",selected.registration_source==="vendor"?"Vendor Created":"PWA Application"],["Created By Vendor",selected.created_by_vendor_id?vendorNames[selected.created_by_vendor_id]||selected.created_by_vendor_id:"—"],["Documents Submitted",Array.isArray(selected.documents_submitted)?(selected.documents_submitted.length?selected.documents_submitted.map((d:any)=>typeof d==="string"?d:(d?.name||d?.type||"Document")).join(", "):"None submitted"):selected.documents_submitted?"Submitted":"None submitted"],["Password","Managed by Supabase Auth — password is not readable"],["Created At",new Date(selected.created_at).toLocaleString("en-IN")],["Updated At",selected.updated_at?new Date(selected.updated_at).toLocaleString("en-IN"):"—"]].map(([label,value])=><div key={label} className="rounded-lg border bg-slate-50 p-3"><p className="text-[10px] uppercase font-bold text-slate-400">{label}</p><p className="text-sm font-semibold mt-1 break-all">{String(value)}</p></div>)}</div><div className="mt-5 flex justify-end gap-2">{selected.application_status==="pending"&&<><button onClick={()=>update(selected.id,"rejected")} className="px-4 py-2 rounded-lg border text-red-600 font-bold text-sm">Reject</button><button onClick={()=>update(selected.id,"approved")} className="px-4 py-2 rounded-lg bg-[#22C55E] text-white font-bold text-sm">Approve</button></>}{selected.application_status==="approved"&&<button onClick={()=>update(selected.id,"suspended")} className="px-4 py-2 rounded-lg border text-red-600 font-bold text-sm">Suspend</button>}</div></div></div>}
 </div>
}