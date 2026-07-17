import React, { useEffect } from "react";
import { useGetSettings, useUpdateSettings, SystemSettingsUpdate } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Save, Settings2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const settingsSchema = z.object({
  factoryName: z.string().min(1),
  factoryLocation: z.string().optional(),
  voiceAlertEnabled: z.boolean(),
  voiceLanguage: z.string(),
  alertRepeatIntervalSeconds: z.coerce.number().min(5),
  rfidEnabled: z.boolean(),
  notificationEmail: z.string().email().or(z.literal('')),
  notificationWebhook: z.string().url().or(z.literal('')),
  sensorThresholds: z.object({
    temperature: z.object({ warning: z.coerce.number(), critical: z.coerce.number() }),
    gas: z.object({ warning: z.coerce.number(), critical: z.coerce.number() }),
    humidity: z.object({ warning: z.coerce.number(), critical: z.coerce.number() }),
  })
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema)
  });

  useEffect(() => {
    if (settings) {
      reset({
        factoryName: settings.factoryName,
        factoryLocation: settings.factoryLocation || "",
        voiceAlertEnabled: settings.voiceAlertEnabled,
        voiceLanguage: settings.voiceLanguage,
        alertRepeatIntervalSeconds: settings.alertRepeatIntervalSeconds,
        rfidEnabled: settings.rfidEnabled,
        notificationEmail: settings.notificationEmail || "",
        notificationWebhook: settings.notificationWebhook || "",
        sensorThresholds: settings.sensorThresholds
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormValues) => {
    updateMutation.mutate({ data }, {
      onSuccess: () => {
        toast.success("System parameters updated");
        queryClient.invalidateQueries({ queryKey: ["getSettings"] } as any);
        reset(data); // reset isDirty
      }
    });
  };

  if (isLoading) {
    return <div className="p-6 text-slate-500 font-mono animate-pulse">Accessing configuration sectors...</div>;
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono flex items-center gap-2">
            <Settings2 size={24} className="text-amber-500" />
            System Parameters
          </h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Core Configuration</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Core Identity */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Global Variables</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Facility Designation</label>
              <input {...register("factoryName")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Geographical Locus</label>
              <input {...register("factoryLocation")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Alerting & Comms */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Alert Protocols</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
               <label className="flex items-center gap-3 cursor-pointer">
                 <input type="checkbox" {...register("voiceAlertEnabled")} className="w-4 h-4 accent-amber-500 bg-slate-950 border-slate-800" />
                 <span className="text-sm text-slate-300 font-mono uppercase">Enable P.A. Voice Broadcasts</span>
               </label>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">TTS Language Vector</label>
                  <select {...register("voiceLanguage")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none">
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="es-ES">Spanish</option>
                    <option value="de-DE">German</option>
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alert Repeat Cadence (Sec)</label>
                  <input type="number" {...register("alertRepeatIntervalSeconds")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
               </div>
             </div>
             <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Emergency Notification Email</label>
                  <input type="email" {...register("notificationEmail")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" placeholder="admin@domain.com" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Integration Webhook URL</label>
                  <input type="url" {...register("notificationWebhook")} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" placeholder="https://" />
               </div>
             </div>
          </div>
        </div>

        {/* Access & Tracking */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Tracking Vectors</h2>
          <label className="flex items-center gap-3 cursor-pointer">
             <input type="checkbox" {...register("rfidEnabled")} className="w-4 h-4 accent-amber-500 bg-slate-950 border-slate-800" />
             <span className="text-sm text-slate-300 font-mono uppercase">Enable RFID Tag Corroboration</span>
          </label>
        </div>

        {/* Sensor Limits */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Telemetry Thresholds</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-4">
              <h3 className="text-white font-mono uppercase border-b border-slate-800 pb-2 mb-2">Temperature (°C)</h3>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Warning Level</label>
                  <input type="number" step="0.1" {...register("sensorThresholds.temperature.warning")} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Critical Level</label>
                  <input type="number" step="0.1" {...register("sensorThresholds.temperature.critical")} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-4">
              <h3 className="text-white font-mono uppercase border-b border-slate-800 pb-2 mb-2">Atmospheric Gas (PPM)</h3>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Warning Level</label>
                  <input type="number" step="0.1" {...register("sensorThresholds.gas.warning")} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Critical Level</label>
                  <input type="number" step="0.1" {...register("sensorThresholds.gas.critical")} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-4">
              <h3 className="text-white font-mono uppercase border-b border-slate-800 pb-2 mb-2">Humidity (%)</h3>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Warning Level</label>
                  <input type="number" step="0.1" {...register("sensorThresholds.humidity.warning")} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Critical Level</label>
                  <input type="number" step="0.1" {...register("sensorThresholds.humidity.critical")} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm font-mono text-white focus:border-amber-500 focus:outline-none" />
              </div>
            </div>

          </div>
        </div>

        <div className="flex justify-end sticky bottom-6 z-10">
           <button 
             type="submit" 
             disabled={updateMutation.isPending || !isDirty}
             className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-3 px-6 rounded shadow-lg uppercase tracking-wider text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Save size={18} /> {updateMutation.isPending ? "Committing..." : "Commit Variables"}
           </button>
        </div>

      </form>
    </div>
  );
}
