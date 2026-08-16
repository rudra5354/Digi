import { supabase } from './supabase';

const getProfiles = async (ids: string[]) => {
  if (!ids.length) return new Map<string, { email: string; full_name: string }>();
  const { data } = await supabase.from('profiles').select('id, email, full_name').in('id', ids);
  return new Map((data || []).map((profile) => [profile.id, profile]));
};

export const getAdminOverview = async () => {
  const { data: userData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error('Failed to retrieve registered users.');
  const [{ count: packageCount }, { count: documentCount }, { data: verifiedLogs }, { data: failedLogs }, { data: activePackages }, { data: audits }, { data: accessLogs }] = await Promise.all([
    supabase.from('packages').select('id', { count: 'exact', head: true }),
    supabase.from('package_files').select('id', { count: 'exact', head: true }),
    supabase.from('package_access_logs').select('package_id').eq('access_type', 'VERIFY').eq('status', 'SUCCESS'),
    supabase.from('package_access_logs').select('id').eq('access_type', 'VERIFY').eq('status', 'FAILED'),
    supabase.from('packages').select('id').eq('status', 'ACTIVE'),
    supabase.from('security_audit_events').select('id, actor_id, event_type, description, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('package_access_logs').select('id, package_id, access_type, status, created_at').order('created_at', { ascending: false }).limit(10),
  ]);

  const verifiedPackageIds = new Set((verifiedLogs || []).map((log) => log.package_id));
  const actorProfiles = await getProfiles((audits || []).map((audit) => audit.actor_id).filter(Boolean));
  const packageIds = [...new Set((accessLogs || []).map((log) => log.package_id))];
  const { data: logPackages } = packageIds.length ? await supabase.from('packages').select('id, title').in('id', packageIds) : { data: [] };
  const packageNames = new Map((logPackages || []).map((pkg) => [pkg.id, pkg.title]));

  const activity = [
    ...(audits || []).map((audit) => ({ id: `audit-${audit.id}`, type: audit.event_type, description: audit.description, actor: audit.actor_id ? actorProfiles.get(audit.actor_id)?.email || 'Unknown user' : 'System', createdAt: audit.created_at })),
    ...(accessLogs || []).map((log) => ({ id: `access-${log.id}`, type: `${log.access_type}_${log.status}`, description: `${log.access_type.toLowerCase()} ${log.status.toLowerCase()} for ${packageNames.get(log.package_id) || 'a package'}`, actor: 'Recipient', createdAt: log.created_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12);

  return {
    statistics: {
      totalUsers: userData.users.length,
      totalDocuments: documentCount || 0,
      totalPackages: packageCount || 0,
      verifiedPackages: verifiedPackageIds.size,
      pendingPackages: (activePackages || []).filter((pkg) => !verifiedPackageIds.has(pkg.id)).length,
      failedVerifications: failedLogs?.length || 0,
    },
    activity,
  };
};

export const getAdminVerifications = async () => {
  const { data: logs, error } = await supabase.from('package_access_logs')
    .select('id, package_id, access_type, status, error_reason, created_at')
    .eq('access_type', 'VERIFY').order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error('Failed to retrieve verification records.');
  const ids = [...new Set((logs || []).map((log) => log.package_id))];
  const { data: packages } = ids.length ? await supabase.from('packages').select('id, title, sender_id').in('id', ids) : { data: [] };
  const packageMap = new Map((packages || []).map((pkg) => [pkg.id, pkg]));
  const profiles = await getProfiles((packages || []).map((pkg) => pkg.sender_id));
  return (logs || []).map((log) => {
    const pkg = packageMap.get(log.package_id);
    return { id: log.id, document: pkg?.title || 'Unavailable package', sender: pkg ? profiles.get(pkg.sender_id)?.email || 'Unknown sender' : 'Unknown sender', method: 'Access code / QR', status: log.status, result: log.error_reason || (log.status === 'SUCCESS' ? 'Verified' : 'Verification failed'), createdAt: log.created_at };
  });
};

export const getAdminActivity = async () => {
  const { data: audits, error } = await supabase.from('security_audit_events')
    .select('id, actor_id, event_type, description, created_at').order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error('Failed to retrieve audit activity.');
  const profiles = await getProfiles((audits || []).map((event) => event.actor_id).filter(Boolean));
  return (audits || []).map((event) => ({ id: event.id, user: event.actor_id ? profiles.get(event.actor_id)?.email || 'Unknown user' : 'System', action: event.event_type, resource: event.description, status: 'RECORDED', createdAt: event.created_at }));
};

export const getAdminUsers = async () => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error('Failed to retrieve registered users.');
  const users = data.users || [];
  const profiles = await getProfiles(users.map((user) => user.id));
  const { data: packages } = await supabase.from('packages').select('sender_id');
  const senderIds = new Set((packages || []).map((pkg) => pkg.sender_id));

  return users.map((user) => {
    const metadata = user.app_metadata as { role?: string; roles?: string[] } | undefined;
    const isAdmin = metadata?.role === 'admin' || metadata?.roles?.includes('admin') === true;
    const profile = profiles.get(user.id);
    return { id: user.id, email: profile?.email || user.email || 'Unknown', name: profile?.full_name || '', role: isAdmin ? 'ADMIN' : senderIds.has(user.id) ? 'SENDER' : 'USER', createdAt: user.created_at };
  });
};

export const getAdminPackages = async () => {
  const { data: packages, error } = await supabase.from('packages').select('id, sender_id, title, status, expires_at, download_count, created_at, pin_hash').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Failed to retrieve packages.');
  const profiles = await getProfiles((packages || []).map((pkg) => pkg.sender_id));
  const ids = (packages || []).map((pkg) => pkg.id);
  const [{ data: files }, { data: verifiedLogs }] = await Promise.all([
    ids.length ? supabase.from('package_files').select('package_id').in('package_id', ids) : { data: [] },
    ids.length ? supabase.from('package_access_logs').select('package_id').in('package_id', ids).eq('access_type', 'VERIFY').eq('status', 'SUCCESS') : { data: [] },
  ]);
  const fileCounts = new Map<string, number>();
  (files || []).forEach((file) => fileCounts.set(file.package_id, (fileCounts.get(file.package_id) || 0) + 1));
  const verified = new Set((verifiedLogs || []).map((log) => log.package_id));
  return (packages || []).map((pkg) => ({ id: pkg.id, title: pkg.title, sender: profiles.get(pkg.sender_id)?.email || 'Unknown sender', status: pkg.status, expiresAt: pkg.expires_at, downloadCount: pkg.download_count, fileCount: fileCounts.get(pkg.id) || 0, hasPin: !!pkg.pin_hash, verificationStatus: verified.has(pkg.id) ? 'VERIFIED' : pkg.status === 'ACTIVE' ? 'PENDING' : pkg.status, createdAt: pkg.created_at }));
};
