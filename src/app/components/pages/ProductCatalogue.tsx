import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PackageSearch, RefreshCw, Search, Save, ImagePlus, Star, X, Plus, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type MasterProduct = { id:string; name:string|null; brand:string|null; category_id:string|null; barcode:string|null; manufacturer:string|null; unit:string|null; weight:string|null; image_url:string|null; status:string|null };
type Category = { id:string; name:string; status?:string|null };
type VendorProduct = { id:string; name:string; vendor_id:string; price:number; stock:number|null; image_url:string|null; status:string|null; universal_product_id:string|null; barcode:string|null; sku:string|null; created_at:string|null };
type Alias = { id:string; universal_product_id:string; alias:string };
type MasterImage = { id:string; universal_product_id:string; image_url:string; is_primary:boolean; source:string };

const errorText=(e:any)=>e?.message||"Something went wrong.";
const productImage=(value:string|null)=>{
 if(!value)return "";
 try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.find((v:any)=>typeof v==="string"&&v.trim())||"";if(typeof parsed==="string")return parsed;}catch{}
 return value;
};
export function ProductCatalogue(){
 const [masters,setMasters]=useState<MasterProduct[]>([]);
 const [listings,setListings]=useState<VendorProduct[]>([]);
 const [aliases,setAliases]=useState<Alias[]>([]);
 const [images,setImages]=useState<MasterImage[]>([]);
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [editing,setEditing]=useState<MasterProduct|null>(null);
 const [aliasText,setAliasText]=useState("");
 const [files,setFiles]=useState<File[]>([]);
 const [showAdd,setShowAdd]=useState(false);
 const [categories,setCategories]=useState<Category[]>([]);
 const [newProduct,setNewProduct]=useState({name:"",brand:"",category_id:"",barcode:"",manufacturer:"",unit:"",weight:"",description:""});
 const [newImage,setNewImage]=useState<File|null>(null);

 const load=useCallback(async()=>{
  setLoading(true);setNotice("");
  try{
   const [m,a,i,cats]=await Promise.all([
    supabase.from("universal_products").select("id,name,brand,category_id,barcode,manufacturer,unit,weight,image_url,status").order("name"),
    supabase.from("universal_product_aliases").select("id,universal_product_id,alias").order("alias"),
    supabase.from("universal_product_images").select("id,universal_product_id,image_url,is_primary,source").order("created_at"),
    supabase.from("product_categories").select("id,name,status").order("name")
   ]);
   if(m.error)throw m.error;if(i.error)throw i.error;if(cats.error)throw cats.error;
   const aliasTableMissing=!!a.error&&(a.error.code==="42P01"||a.error.code==="PGRST205"||a.error.message?.toLowerCase().includes("not found"));
   if(a.error&&!aliasTableMissing)throw a.error;
   if(aliasTableMissing)setNotice("Catalogue loaded, but aliases are unavailable: apply supabase/migrations/202611170001_universal_product_aliases.sql in Supabase SQL Editor.");
   const all:VendorProduct[]=[];
   for(let from=0;;from+=1000){
    const {data,error}=await supabase.from("products").select("id,name,vendor_id,price,stock,image_url,status,universal_product_id,barcode,sku,created_at").order("created_at",{ascending:false}).range(from,from+999);
    if(error)throw error;const page=(data||[]) as VendorProduct[];all.push(...page);if(page.length<1000)break;
   }
   setMasters(m.data||[]);setAliases(a.error?[]:a.data||[]);setImages(i.data||[]);setListings(all);setCategories(cats.data||[]);
  }catch(e){setNotice(errorText(e));}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);

 const filteredMasters=useMemo(()=>masters.filter(p=>[p.name,p.brand,p.barcode,p.manufacturer,p.weight].some(v=>(v||"").toLowerCase().includes(query.toLowerCase().trim()))),[masters,query]);
 const filteredListings=useMemo(()=>listings.filter(p=>[p.name,p.barcode,p.sku,p.vendor_id].some(v=>(v||"").toLowerCase().includes(query.toLowerCase().trim()))),[listings,query]);
 const currentAliases=editing?aliases.filter(a=>a.universal_product_id===editing.id):[];
 const currentImages=editing?images.filter(i=>i.universal_product_id===editing.id):[];

 function openEdit(p:MasterProduct){setEditing(p);setAliasText(aliases.filter(a=>a.universal_product_id===p.id).map(a=>a.alias).join("\n"));setFiles([]);setNotice("");}

 async function addMasterProduct(){
  if(!newProduct.name.trim()){setNotice("Enter a product name.");return;}
  setBusy(true);setNotice("");
  try{
   const payload:any={name:newProduct.name.trim(),brand:newProduct.brand.trim()||null,category_id:newProduct.category_id||null,barcode:newProduct.barcode.trim()||null,manufacturer:newProduct.manufacturer.trim()||null,unit:newProduct.unit.trim()||null,weight:newProduct.weight.trim()||null,description:newProduct.description.trim()||null,status:"active"};
   const {data,error}=await supabase.from("universal_products").insert(payload).select("id").single();
   if(error)throw error;
   if(newImage){
    if(!newImage.type.startsWith("image/"))throw new Error("Select a valid image file.");
    const ext=(newImage.name.split(".").pop()||"jpg").toLowerCase();
    const storagePath=`master-products/${data.id}/${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("product-images").upload(storagePath,newImage,{upsert:false,contentType:newImage.type,cacheControl:"31536000"});
    if(uploadError)throw uploadError;
    const imageUrl=supabase.storage.from("product-images").getPublicUrl(storagePath).data.publicUrl;
    const {error:imageError}=await supabase.from("universal_product_images").insert({universal_product_id:data.id,image_url:imageUrl,is_primary:true,source:"admin"});
    if(imageError)throw imageError;
    const {error:updateError}=await supabase.from("universal_products").update({image_url:imageUrl}).eq("id",data.id);
    if(updateError)throw updateError;
   }
   setNotice("Master product added successfully.");
   setNewProduct({name:"",brand:"",category_id:"",barcode:"",manufacturer:"",unit:"",weight:"",description:""});
   setNewImage(null);setShowAdd(false);await load();
  }catch(e){setNotice(errorText(e));}finally{setBusy(false);}
 }
 async function saveAliases(){
  if(!editing)return;setBusy(true);setNotice("");
  try{
   const desired=[...new Set(aliasText.split("\n").map(v=>v.trim()).filter(Boolean))];
   const {data:old,error:oldErr}=await supabase.from("universal_product_aliases").select("id,alias").eq("universal_product_id",editing.id);
   if(oldErr)throw oldErr;
   const desiredKeys=new Set(desired.map(v=>v.toLocaleLowerCase()));
   const remove=(old||[]).filter((a:any)=>!desiredKeys.has(String(a.alias).toLocaleLowerCase())).map((a:any)=>a.id);
   if(remove.length){const {error}=await supabase.from("universal_product_aliases").delete().in("id",remove);if(error)throw error;}
   const oldKeys=new Set((old||[]).map((a:any)=>String(a.alias).toLocaleLowerCase()));
   const add=desired.filter(v=>!oldKeys.has(v.toLocaleLowerCase())).map(alias=>({universal_product_id:editing.id,alias}));
   if(add.length){const {error}=await supabase.from("universal_product_aliases").insert(add);if(error)throw error;}
   setNotice("Aliases saved.");await load();
  }catch(e){setNotice(errorText(e));}finally{setBusy(false);}
 }

 async function uploadImages(){
  if(!editing||!files.length)return;setBusy(true);setNotice("");
  try{
   for(const file of files){
    if(!file.type.startsWith("image/"))throw new Error(`${file.name} is not an image.`);
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    const path=`master-products/${editing.id}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"31536000"});
    if(error)throw error;
    const url=supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    const {error:insertError}=await supabase.from("universal_product_images").insert({universal_product_id:editing.id,image_url:url,is_primary:currentImages.length===0&&files[0]===file,source:"admin"});
    if(insertError)throw insertError;
   }
   setFiles([]);setNotice("Images uploaded to the shared product gallery.");await load();
  }catch(e){setNotice(errorText(e));}finally{setBusy(false);}
 }

 async function setPrimary(image:MasterImage){
  setBusy(true);setNotice("");
  try{const {error}=await supabase.rpc("set_universal_product_primary_image",{p_image_id:image.id});if(error)throw error;setNotice("Primary image updated.");await load();}
  catch(e){setNotice(errorText(e));}finally{setBusy(false);}
 }

 return <section className="space-y-5">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">RivoCity Admin</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Product Catalogue</h1><p className="mt-1 text-sm text-slate-500">Add shared catalogue products and manage aliases and images. Vendors manage their own pricing and inventory.</p></div><button onClick={()=>setShowAdd(v=>!v)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white inline-flex gap-2 items-center"><Plus size={16}/> Add product</button></header>
  {notice&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</div>}
  {showAdd&&<div className="rounded-xl border bg-white p-5 space-y-4">
   <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Add master product</h2><p className="text-xs text-slate-500">Create a shared catalogue entry. No vendor price, stock, MRP or expiry fields.</p></div><button onClick={()=>setShowAdd(false)} className="rounded-lg border p-2"><X size={16}/></button></div>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Product name *</span><input value={newProduct.name} onChange={e=>setNewProduct(v=>({...v,name:e.target.value}))} placeholder="e.g. Tata Salt 1 kg" className="w-full rounded-lg border px-3 py-2.5"/></label>
    <label className="space-y-1 text-sm"><span className="font-medium">Category</span><select value={newProduct.category_id} onChange={e=>setNewProduct(v=>({...v,category_id:e.target.value}))} className="w-full rounded-lg border px-3 py-2.5"><option value="">Select category</option>{categories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
    <label className="space-y-1 text-sm"><span className="font-medium">Brand</span><input value={newProduct.brand} onChange={e=>setNewProduct(v=>({...v,brand:e.target.value}))} placeholder="Brand name" className="w-full rounded-lg border px-3 py-2.5"/></label>
    <label className="space-y-1 text-sm"><span className="font-medium">Barcode</span><input value={newProduct.barcode} onChange={e=>setNewProduct(v=>({...v,barcode:e.target.value}))} placeholder="Barcode / EAN" className="w-full rounded-lg border px-3 py-2.5"/></label>
    <label className="space-y-1 text-sm"><span className="font-medium">Manufacturer</span><input value={newProduct.manufacturer} onChange={e=>setNewProduct(v=>({...v,manufacturer:e.target.value}))} placeholder="Manufacturer" className="w-full rounded-lg border px-3 py-2.5"/></label>
    <label className="space-y-1 text-sm"><span className="font-medium">Pack size / weight</span><input value={newProduct.weight} onChange={e=>setNewProduct(v=>({...v,weight:e.target.value}))} placeholder="e.g. 1 kg, 500 ml" className="w-full rounded-lg border px-3 py-2.5"/></label>
    <label className="space-y-1 text-sm"><span className="font-medium">Unit</span><input value={newProduct.unit} onChange={e=>setNewProduct(v=>({...v,unit:e.target.value}))} placeholder="Pcs, Kg, Ltr, Pack" className="w-full rounded-lg border px-3 py-2.5"/></label>
    <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Description</span><textarea rows={2} value={newProduct.description} onChange={e=>setNewProduct(v=>({...v,description:e.target.value}))} placeholder="Optional product description" className="w-full rounded-lg border px-3 py-2.5"/></label>
    <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Product image</span><input type="file" accept="image/*" onChange={e=>setNewImage(e.target.files?.[0]||null)} className="block w-full rounded-lg border p-2"/>{newImage&&<span className="text-xs text-slate-500">{newImage.name}</span>}</label>
   </div>
   <div className="flex justify-end gap-2"><button onClick={()=>setShowAdd(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy||!newProduct.name.trim()} onClick={()=>void addMasterProduct()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>} {busy?"Saving…":"Save product"}</button></div>
  </div>}  <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Vendor listings</div><div className="text-2xl font-bold">{listings.length}</div></div><div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Master products</div><div className="text-2xl font-bold">{masters.length}</div></div><div className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">Shared images</div><div className="text-2xl font-bold">{images.length}</div></div></div>
  <div className="rounded-xl border bg-white"><div className="flex gap-2 border-b p-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product name, barcode, SKU or vendor ID" className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm"/></div><button onClick={()=>void load()} className="rounded-lg border px-3"><RefreshCw size={16}/></button></div>
   <div className="border-b px-4 py-3"><h2 className="font-bold">Existing vendor product listings ({filteredListings.length})</h2><p className="text-xs text-slate-500">Read-only. Price, MRP, batch, expiry and stock are managed in Vendor Portal.</p></div>
   {loading?<div className="p-10 text-center text-sm text-slate-500">Loading products…</div>:<div className="divide-y">{filteredListings.map(p=><div key={p.id} className="flex items-center gap-3 p-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-50">{productImage(p.image_url)&&<img src={productImage(p.image_url)} className="h-full w-full object-contain" alt=""/>}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{p.name}</div><div className="truncate text-xs text-slate-500">Vendor {p.vendor_id} · {p.universal_product_id?"Linked to master":"Not linked"}</div></div><span className="text-xs text-slate-400">{p.sku||p.barcode||""}</span></div>)}</div>}
  </div>
  <div className="rounded-xl border bg-white"><div className="border-b px-4 py-3"><h2 className="font-bold">Shared master products ({filteredMasters.length})</h2></div>
   {loading?<div className="p-8 text-center text-sm text-slate-500">Loading…</div>:filteredMasters.length===0?<div className="p-8 text-center text-sm text-slate-500">No master products found.</div>:<div className="divide-y">{filteredMasters.map(p=><div key={p.id} className="flex items-center gap-3 p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-50">{p.image_url?<img src={p.image_url} className="h-full w-full object-contain" alt=""/>:<PackageSearch className="m-4 text-slate-300"/>}</div><div className="min-w-0 flex-1"><div className="font-semibold">{p.name||"Unnamed product"}</div><div className="text-xs text-slate-500">{p.brand||"No brand"} · {aliases.filter(a=>a.universal_product_id===p.id).length} aliases · {images.filter(i=>i.universal_product_id===p.id).length} images</div></div><button onClick={()=>openEdit(p)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Edit aliases & images</button></div>)}</div>}
  </div>
  {editing&&<div className="rounded-xl border bg-white p-4 space-y-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-lg">Manage catalogue media</h2><p className="text-sm text-slate-500">{editing.name} {editing.weight||""} · {editing.brand||""}</p><p className="text-xs text-slate-500">Only aliases and shared images can be changed here.</p></div><button onClick={()=>setEditing(null)} className="rounded-lg border p-2"><X size={16}/></button></div>
   <section className="space-y-2"><h3 className="text-sm font-semibold">Aliases / alternate search names</h3><textarea rows={5} value={aliasText} onChange={e=>setAliasText(e.target.value)} placeholder={"Tata Namak 1kg\nTata Salt 1kg\nटाटा नमक 1 किलो"} className="w-full rounded-lg border p-3 text-sm"/><p className="text-xs text-slate-500">One alias per line. Existing aliases are loaded automatically.</p><div className="flex justify-end"><button disabled={busy} onClick={()=>void saveAliases()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Save size={15}/> Save aliases</button></div></section>
   <section className="space-y-3 border-t pt-4"><div><h3 className="text-sm font-semibold">Shared product images</h3><p className="text-xs text-slate-500">Upload multiple images. Choose which image is primary for the shared catalogue.</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{currentImages.map(image=><div key={image.id} className="overflow-hidden rounded-xl border"><div className="aspect-square bg-slate-50"><img src={image.image_url} alt="" className="h-full w-full object-contain"/></div><div className="flex items-center justify-between gap-2 p-2"><span className="text-xs">{image.is_primary?"Primary":"Gallery image"}</span><button disabled={busy||image.is_primary} onClick={()=>void setPrimary(image)} title="Set as primary" className="rounded-md border p-1.5 disabled:opacity-40"><Star size={14} fill={image.is_primary?"currentColor":"none"}/></button></div></div>)}</div>
    <input type="file" accept="image/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} className="block w-full text-sm"/>{files.length>0&&<div className="flex items-center justify-between"><span className="text-xs text-slate-500">{files.length} image(s) selected</span><button disabled={busy} onClick={()=>void uploadImages()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><ImagePlus size={15}/> Upload images</button></div>}
   </section>
  </div>}
 </section>;
}
