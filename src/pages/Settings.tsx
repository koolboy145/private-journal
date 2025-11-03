import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getColorThemeOptions, parseThemeName, type ThemeName } from '@/lib/themes';
import { auth, entries, tags as tagsApi, reminders as remindersApi, templates as templatesApi, Tag, Reminder, Template } from '@/lib/api';
import { toast } from 'sonner';
import { Download, Upload, Key, User, Tag as TagIcon, Plus, X, Edit2, Trash2, Bell, FileText, Settings as SettingsIcon, Palette, Wrench, Info } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { themeName, setThemeName } = useTheme();
  const themeOptions = getColorThemeOptions();
  const { colorTheme, isDark } = parseThemeName(themeName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [encryptExport, setEncryptExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);

  // Password verification for export
  const [showExportPasswordDialog, setShowExportPasswordDialog] = useState(false);
  const [exportLoginPassword, setExportLoginPassword] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Autosave preference
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem('autosave_enabled');
    return saved === null ? true : saved === 'true';
  });

  // Default entry view mode preference
  const [defaultEntryViewMode, setDefaultEntryViewMode] = useState<'list' | 'grid' | 'timeline'>(() => {
    const saved = localStorage.getItem('default_entry_view_mode');
    return (saved === 'list' || saved === 'grid' || saved === 'timeline') ? saved : 'list';
  });

  // Tags management
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isDeletingTag, setIsDeletingTag] = useState<string | null>(null);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // Reminders management
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [isDeletingReminder, setIsDeletingReminder] = useState<string | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [newReminder, setNewReminder] = useState({
    title: '',
    body: '',
    time: '09:00',
    daysOfWeek: [] as number[],
    notificationType: null as 'email' | 'webhook' | null,
    emailAddress: '',
    webhookUrl: '',
    isEnabled: false,
  });
  const [editingReminder, setEditingReminder] = useState({
    title: '',
    body: '',
    time: '09:00',
    daysOfWeek: [] as number[],
    notificationType: null as 'email' | 'webhook' | null,
    emailAddress: '',
    webhookUrl: '',
    isEnabled: false,
  });

  // Templates management
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [templateContent, setTemplateContent] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [activeTab, setActiveTab] = useState('account');

  useEffect(() => {
    if (user) {
      loadTags();
      loadReminders();
      loadTemplates();
      // Load profile fields
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleAutosaveToggle = (checked: boolean) => {
    setAutosaveEnabled(checked);
    localStorage.setItem('autosave_enabled', String(checked));
    toast.success(`Autosave ${checked ? 'enabled' : 'disabled'}`);
  };

  const handleDefaultViewModeChange = (value: 'list' | 'grid' | 'timeline') => {
    const oldDefault = defaultEntryViewMode;
    setDefaultEntryViewMode(value);
    localStorage.setItem('default_entry_view_mode', value);

    // Check if current view mode matches the old default - if so, update it to new default
    const currentViewMode = localStorage.getItem('entry_view_mode');
    // If no explicit view mode is set, or if it matches the old default, update it
    if (!currentViewMode || currentViewMode === oldDefault) {
      localStorage.setItem('entry_view_mode', value);
      // Dispatch custom event for same-tab updates (synchronous)
      window.dispatchEvent(new CustomEvent('default-entry-view-mode-changed', {
        detail: { newValue: value, oldValue: oldDefault }
      }));
    } else {
      // Even if we don't update entry_view_mode, still dispatch event so components know default changed
      window.dispatchEvent(new CustomEvent('default-entry-view-mode-changed', {
        detail: { newValue: value, oldValue: oldDefault }
      }));
    }

    toast.success('Default view mode updated');
  };

  const formatTagName = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, '-');
  };

  const loadTags = async () => {
    setIsLoadingTags(true);
    try {
      const data = await tagsApi.getAll();
      // Sort tags alphabetically by name
      const sortedTags = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setTags(sortedTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreatingTag(true);
    try {
      const formattedName = formatTagName(newTagName);
      const newTag = await tagsApi.create(formattedName);
      // Sort tags alphabetically after adding new tag
      const updatedTags = [...tags, newTag].sort((a, b) => a.name.localeCompare(b.name));
      setTags(updatedTags);
      setNewTagName('');
      toast.success('Tag created successfully');
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error('Failed to create tag');
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  const handleUpdateTag = async (tagId: string) => {
    if (!editingTagName.trim()) return;

    try {
      const formattedName = formatTagName(editingTagName);
      const updatedTag = await tagsApi.update(tagId, formattedName);
      // Sort tags alphabetically after updating tag
      const updatedTags = tags.map(t => t.id === tagId ? updatedTag : t).sort((a, b) => a.name.localeCompare(b.name));
      setTags(updatedTags);
      handleCancelEdit();
      toast.success('Tag updated successfully');
    } catch (error) {
      console.error('Failed to update tag:', error);
      toast.error('Failed to update tag');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;

    setIsDeletingTag(tagId);
    try {
      await tagsApi.delete(tagId);
      // Tags remain sorted after deletion (filtering doesn't change order)
      setTags(tags.filter(t => t.id !== tagId));
      toast.success('Tag deleted successfully');
    } catch (error) {
      console.error('Failed to delete tag:', error);
      toast.error('Failed to delete tag');
    } finally {
      setIsDeletingTag(null);
    }
  };

  const loadReminders = async () => {
    setIsLoadingReminders(true);
    try {
      const data = await remindersApi.getAll();
      setReminders(data);
    } catch (error) {
      console.error('Failed to load reminders:', error);
      toast.error('Failed to load reminders');
    } finally {
      setIsLoadingReminders(false);
    }
  };

  // Validate webhook URL format
  const isValidWebhookUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    const urlPattern = /^https?:\/\/.+/;
    return urlPattern.test(url.trim());
  };

  // Validation for required fields based on notification type
  const isCreateReminderValid = () => {
    if (!newReminder.notificationType) return false;

    if (newReminder.notificationType === 'email') {
      return (
        newReminder.title.trim() !== '' &&
        newReminder.emailAddress.trim() !== '' &&
        newReminder.daysOfWeek.length > 0
      );
    }

    if (newReminder.notificationType === 'webhook') {
      return (
        newReminder.title.trim() !== '' &&
        newReminder.webhookUrl.trim() !== '' &&
        isValidWebhookUrl(newReminder.webhookUrl) &&
        newReminder.daysOfWeek.length > 0
      );
    }

    return false;
  };

  const handleCreateReminder = async () => {
    if (!newReminder.title.trim() || !newReminder.notificationType) return;

    // Check if reminder is disabled and show warning
    if (!newReminder.isEnabled) {
      const shouldProceed = confirm('The reminder is currently disabled. It needs to be enabled for notifications to begin. Do you want to continue creating it as disabled?');
      if (!shouldProceed) {
        return;
      }
    }

    setIsCreatingReminder(true);
    try {
      await remindersApi.create(
        newReminder.title,
        newReminder.time,
        newReminder.daysOfWeek,
        newReminder.notificationType,
        newReminder.emailAddress || null,
        newReminder.webhookUrl || null,
        newReminder.body || null,
        newReminder.isEnabled || false
      );
      await loadReminders();
      setNewReminder({
        title: '',
        body: '',
        time: '09:00',
        daysOfWeek: [],
        notificationType: null,
        emailAddress: '',
        webhookUrl: '',
        isEnabled: false,
      });
      toast.success('Reminder created successfully');
    } catch (error) {
      console.error('Failed to create reminder:', error);
      toast.error('Failed to create reminder');
    } finally {
      setIsCreatingReminder(false);
    }
  };

  const handleStartEditReminder = (reminder: Reminder) => {
    setEditingReminderId(reminder.id);
    setEditingReminder({
      title: reminder.title,
      body: reminder.body || '',
      time: reminder.time,
      daysOfWeek: reminder.daysOfWeek,
      notificationType: reminder.notificationType,
      emailAddress: reminder.emailAddress || '',
      webhookUrl: reminder.webhookUrl || '',
      isEnabled: reminder.isEnabled,
    });
  };

  const handleCancelEditReminder = () => {
    setEditingReminderId(null);
    setEditingReminder({
      title: '',
      body: '',
      time: '09:00',
      daysOfWeek: [],
      notificationType: null,
      emailAddress: '',
      webhookUrl: '',
      isEnabled: false,
    });
  };

  // Validation for editing reminder
  const isEditReminderValid = () => {
    if (!editingReminder.notificationType) return false;

    if (editingReminder.notificationType === 'email') {
      return (
        editingReminder.title.trim() !== '' &&
        editingReminder.emailAddress.trim() !== '' &&
        editingReminder.daysOfWeek.length > 0
      );
    }

    if (editingReminder.notificationType === 'webhook') {
      return (
        editingReminder.title.trim() !== '' &&
        editingReminder.webhookUrl.trim() !== '' &&
        isValidWebhookUrl(editingReminder.webhookUrl) &&
        editingReminder.daysOfWeek.length > 0
      );
    }

    return false;
  };

  const handleUpdateReminder = async (reminderId: string) => {
    if (!editingReminder.title.trim() || !editingReminder.notificationType) return;

    // Validate webhook URL if webhook notification type
    if (editingReminder.notificationType === 'webhook' && !isValidWebhookUrl(editingReminder.webhookUrl)) {
      toast.error('Please enter a valid webhook URL starting with http:// or https://');
      return;
    }

    try {
      await remindersApi.update(
        reminderId,
        editingReminder.title,
        editingReminder.time,
        editingReminder.daysOfWeek,
        editingReminder.notificationType,
        editingReminder.emailAddress || null,
        editingReminder.webhookUrl || null,
        editingReminder.body || null,
        editingReminder.isEnabled || false
      );
      await loadReminders();
      handleCancelEditReminder();
      toast.success('Reminder updated successfully');
    } catch (error) {
      console.error('Failed to update reminder:', error);
      toast.error('Failed to update reminder');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    setIsDeletingReminder(reminderId);
    try {
      await remindersApi.delete(reminderId);
      await loadReminders();
      toast.success('Reminder deleted successfully');
    } catch (error) {
      console.error('Failed to delete reminder:', error);
      toast.error('Failed to delete reminder');
    } finally {
      setIsDeletingReminder(null);
    }
  };

  const toggleDayOfWeek = (dayIndex: number, isEditing: boolean) => {
    if (isEditing) {
      const days = editingReminder.daysOfWeek.includes(dayIndex)
        ? editingReminder.daysOfWeek.filter(d => d !== dayIndex)
        : [...editingReminder.daysOfWeek, dayIndex];
      setEditingReminder({ ...editingReminder, daysOfWeek: days });
    } else {
      const days = newReminder.daysOfWeek.includes(dayIndex)
        ? newReminder.daysOfWeek.filter(d => d !== dayIndex)
        : [...newReminder.daysOfWeek, dayIndex];
      setNewReminder({ ...newReminder, daysOfWeek: days });
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await templatesApi.getAll();
      if (data.length === 0) {
        // Create default template
        const defaultTemplate = await templatesApi.create('Default Template', '# Daily Reflection\n\n## Today\'s Goals\n\n## Gratitude\n\n## Notes\n');
        setTemplates([defaultTemplate]);
      } else {
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !templateContent.trim()) return;

    setIsCreatingTemplate(true);
    try {
      const newTemplate = await templatesApi.create(newTemplateName, templateContent);
      setTemplates([...templates, newTemplate]);
      setNewTemplateName('');
      setTemplateContent('');
      setIsCreatingNew(false);
      setSelectedTemplateId('none');
      toast.success('Template created successfully');
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error('Failed to create template');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const handleStartNewTemplate = () => {
    setIsCreatingNew(true);
    setSelectedTemplateId('none');
    setTemplateContent('');
    setNewTemplateName('');
    setEditingTemplateId(null);
  };

  const handleStartEditTemplate = (template: Template) => {
    setEditingTemplateId(template.id);
    setSelectedTemplateId(template.id);
    setTemplateContent(template.content);
    setIsCreatingNew(false);
    setNewTemplateName('');
  };

  const handleCancelEditTemplate = () => {
    setEditingTemplateId(null);
    setSelectedTemplateId('none');
    setTemplateContent('');
    setIsCreatingNew(false);
    setNewTemplateName('');
  };

  const handleTemplateSelect = (value: string) => {
    if (value === 'none') {
      setSelectedTemplateId('none');
      setTemplateContent('');
      setEditingTemplateId(null);
      setIsCreatingNew(false);
      return;
    }
    const template = templates.find(t => t.id === value);
    if (template) {
      handleStartEditTemplate(template);
    }
  };

  const handleUpdateTemplate = async (templateId: string) => {
    if (!templateContent.trim()) return;

    try {
      const template = templates.find(t => t.id === templateId);
      if (!template) return;

      const updatedTemplate = await templatesApi.update(templateId, template.name, templateContent);
      setTemplates(templates.map(t => t.id === templateId ? updatedTemplate : t));
      handleCancelEditTemplate();
      toast.success('Template updated successfully');
    } catch (error) {
      console.error('Failed to update template:', error);
      toast.error('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setIsDeletingTemplate(templateId);
    try {
      await templatesApi.delete(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
      handleCancelEditTemplate();
      toast.success('Template deleted successfully');
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Failed to delete template');
    } finally {
      setIsDeletingTemplate(null);
    }
  };

  const handleProfileUpdate = async () => {
    setIsUpdatingProfile(true);
    try {
      const updatedUser = await auth.updateProfile(
        firstName.trim() || null,
        lastName.trim() || null,
        email.trim() || null
      );
      toast.success('Profile updated successfully');
      // Reload to get updated user data
      window.location.reload();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await auth.updatePassword(currentPassword, newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to update password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const verifyExportPassword = async (password: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Use login endpoint to verify password
      await auth.login(user.username, password);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleExportPasswordSubmit = async () => {
    if (!exportLoginPassword.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setIsVerifyingPassword(true);
    try {
      const isValid = await verifyExportPassword(exportLoginPassword);
      if (isValid) {
        setShowExportPasswordDialog(false);
        setExportLoginPassword('');
        // Proceed with export
        performExport();
      } else {
        toast.error('Incorrect password. Please try again.');
        setExportLoginPassword('');
      }
    } catch (error) {
      toast.error('Failed to verify password');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const performExport = async () => {
    if (!user) return;

    if (encryptExport && !exportPassword) {
      toast.error('Please enter an encryption password');
      return;
    }

    if (encryptExport && exportPassword.length < 8) {
      toast.error('Encryption password must be at least 8 characters');
      return;
    }

    try {
      const json = await entries.exportJSON(encryptExport ? exportPassword : undefined);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `journal-export${encryptExport ? '-encrypted' : ''}-${new Date().toISOString().split('T')[0]}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (encryptExport) {
        toast.success('Data exported and encrypted successfully');
        setExportPassword('');
      } else {
        toast.success('Data exported successfully');
      }
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const handleExport = () => {
    // Show password dialog first
    setShowExportPasswordDialog(true);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;

        if (json.startsWith('ENCRYPTED:')) {
          setShowImportPassword(true);
          (window as any).pendingJSONImport = json;
          toast.info('This file is encrypted. Please enter the password.');
          return;
        }

        const result = await entries.importJSON(json);

        if (result.skipped > 0) {
          toast.success(`${result.message}`);
        } else {
          toast.success(`Imported ${result.total} items (${result.entries} entries, ${result.tags} tags, ${result.templates} templates) successfully`);
        }

        window.location.reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleEncryptedImport = async () => {
    if (!importPassword) {
      toast.error('Please enter the decryption password');
      return;
    }

    try {
      const json = (window as any).pendingJSONImport;
      if (!json) {
        toast.error('No file to import');
        return;
      }

      const result = await entries.importJSON(json, importPassword);

      if (result.skipped > 0) {
        toast.success(`${result.message}`);
      } else {
        toast.success(`Imported ${result.total} items (${result.entries} entries, ${result.tags} tags, ${result.templates} templates) successfully`);
      }

      delete (window as any).pendingJSONImport;
      setShowImportPassword(false);
      setImportPassword('');

      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decrypt or import file');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <TabsList className="flex flex-col h-auto w-full p-1 bg-muted/50">
              <TabsTrigger
                value="account"
                className="w-full justify-start data-[state=active]:bg-background"
              >
                <User className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
              <TabsTrigger
                value="personalization"
                className="w-full justify-start data-[state=active]:bg-background"
              >
                <Palette className="h-4 w-4 mr-2" />
                Personalization
              </TabsTrigger>
              <TabsTrigger
                value="journal-tools"
                className="w-full justify-start data-[state=active]:bg-background"
              >
                <Wrench className="h-4 w-4 mr-2" />
                Journal Tools
              </TabsTrigger>
              <TabsTrigger
                value="about"
                className="w-full justify-start data-[state=active]:bg-background"
              >
                <Info className="h-4 w-4 mr-2" />
                About
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-w-0">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <TabsContent value="account" className="mt-0 space-y-6">
                {/* User Profile */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      User Profile
                    </CardTitle>
                    <CardDescription>Your account profile information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={user?.username} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input
                        id="first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input
                        id="last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                      />
                    </div>
                    <Button onClick={handleProfileUpdate} disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Change Password */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>Update your account password</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <Button onClick={handlePasswordChange} disabled={isUpdatingPassword}>
                      {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="personalization" className="mt-0 space-y-6">
                {/* Theme */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Theme
                    </CardTitle>
                    <CardDescription>Choose a theme for the application (includes color scheme and light/dark mode)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="theme-selector">Theme</Label>
                      <Select
                        value={themeName}
                        onValueChange={(value) => {
                          setThemeName(value as ThemeName);
                          const { colorTheme: ct } = parseThemeName(value as ThemeName);
                          toast.success(`Theme changed to ${ct.charAt(0).toUpperCase() + ct.slice(1)}`);
                        }}
                      >
                        <SelectTrigger id="theme-selector">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {themeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-2">
                        {colorTheme === 'default' && (isDark ? 'The default dark theme with standard colors' : 'The default light theme with standard colors')}
                        {colorTheme === 'tron' && (isDark ? 'Jet Black background with Crimson Neon as primary and White accents' : 'Jet Black background with Crimson Neon as primary and White accents')}
                        {colorTheme === 'nature' && (isDark ? 'Dark earthy tones with Charcoal, Sage Green, and Cream accents' : 'Charcoal, Sage Green, and Cream')}
                        {colorTheme === 'playful' && (isDark ? 'Dark background with Coral, Mustard Yellow, and Aqua Blue accents' : 'Coral, Mustard Yellow, and Aqua Blue')}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* AutoSave */}
                <Card>
                  <CardHeader>
                    <CardTitle>Autosave</CardTitle>
                    <CardDescription>Automatically save entries after you stop typing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Autosave</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically save entries after you stop typing
                        </p>
                      </div>
                      <Switch checked={autosaveEnabled} onCheckedChange={handleAutosaveToggle} />
                    </div>
                  </CardContent>
                </Card>

                {/* Journal Entries View */}
                <Card>
                  <CardHeader>
                    <CardTitle>Journal Entries View</CardTitle>
                    <CardDescription>Choose the default view mode for displaying journal entries</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="default-view-mode">Default View Mode</Label>
                      <Select
                        value={defaultEntryViewMode}
                        onValueChange={(value) => handleDefaultViewModeChange(value as 'list' | 'grid' | 'timeline')}
                      >
                        <SelectTrigger id="default-view-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="list">List View</SelectItem>
                          <SelectItem value="grid">Grid View</SelectItem>
                          <SelectItem value="timeline">Timeline View</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-2">
                        This will be the default view when you first load the Dashboard or Diary page. You can always change it using the view toggle buttons.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="journal-tools" className="mt-0 space-y-6">
                {/* Tag Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TagIcon className="h-5 w-5" />
                      Tag Management
                    </CardTitle>
                    <CardDescription>Create, edit, and manage your journal entry tags</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <div className="space-y-2 flex-1">
                        <Input
                          placeholder="Enter tag name (e.g., work, personal life)"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTagName.trim()) {
                              handleCreateTag();
                            }
                          }}
                        />
                        {newTagName.trim() && (
                          <div className="text-xs text-muted-foreground">
                            Will create: <span className="font-mono">#{formatTagName(newTagName)}</span>
                            {formatTagName(newTagName) !== newTagName.trim().toLowerCase() && (
                              <span className="ml-2">(spaces will become hyphens)</span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button onClick={handleCreateTag} disabled={isCreatingTag || !newTagName.trim()}>
                        <Plus className="h-4 w-4 mr-2" />
                        {isCreatingTag ? 'Creating...' : 'Create Tag'}
                      </Button>
                    </div>

                    {isLoadingTags ? (
                      <div className="text-center py-8 text-muted-foreground">Loading tags...</div>
                    ) : tags.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No tags yet. Create your first tag above!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Your Tags</Label>
                        <div className="space-y-2 border rounded-lg p-3 max-h-96 overflow-y-auto">
                          {tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors"
                            >
                              {editingTagId === tag.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editingTagName}
                                    onChange={(e) => setEditingTagName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleUpdateTag(tag.id);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEdit();
                                      }
                                    }}
                                    className="h-8"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleUpdateTag(tag.id)}
                                    disabled={!editingTagName.trim()}
                                  >
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Badge variant="secondary" className="gap-1">
                                    #{tag.name}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStartEdit(tag)}
                                      className="h-8 w-8 p-0"
                                      title="Edit tag"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteTag(tag.id)}
                                      disabled={isDeletingTag === tag.id}
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                      title="Delete tag"
                                    >
                                      {isDeletingTag === tag.id ? (
                                        <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Templates */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Templates
                    </CardTitle>
                    <CardDescription>Create and manage templates for journal entries</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Label>Edit Template</Label>
                        <Button
                          onClick={handleStartNewTemplate}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Template
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Select
                          value={selectedTemplateId === 'none' ? 'none' : selectedTemplateId}
                          onValueChange={handleTemplateSelect}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template to edit" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {(selectedTemplateId !== 'none' || isCreatingNew) && (
                        <>
                          {isCreatingNew && (
                            <div className="space-y-2">
                              <Label htmlFor="template-name">New Template Name</Label>
                              <Input
                                id="template-name"
                                placeholder="e.g., Daily Reflection"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="template-content">Template Content</Label>
                            <MarkdownEditor
                              value={templateContent}
                              onChange={setTemplateContent}
                              placeholder="Enter your template content here using Markdown. This will be used to autofill entries when selected."
                              rows={8}
                            />
                          </div>

                          <div className="flex gap-2">
                            {editingTemplateId ? (
                              <>
                                <Button
                                  onClick={() => handleUpdateTemplate(editingTemplateId)}
                                  disabled={!templateContent.trim()}
                                  className="flex-1"
                                >
                                  Update Template
                                </Button>
                                <Button
                                  onClick={handleCancelEditTemplate}
                                  variant="outline"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => handleDeleteTemplate(editingTemplateId)}
                                  disabled={isDeletingTemplate === editingTemplateId}
                                  variant="destructive"
                                >
                                  {isDeletingTemplate === editingTemplateId ? (
                                    <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <Button
                                onClick={handleCreateTemplate}
                                disabled={isCreatingTemplate || !newTemplateName.trim() || !templateContent.trim()}
                                className="w-full"
                              >
                                {isCreatingTemplate ? 'Creating...' : 'Create Template'}
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {isLoadingTemplates ? (
                      <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
                    ) : templates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No templates yet. Create your first template above!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Label>Your Templates</Label>
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="border rounded-lg p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{template.name}</h4>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {template.content.substring(0, 100)}{template.content.length > 100 ? '...' : ''}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Created: {new Date(template.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEditTemplate(template)}
                                  className="h-8 w-8 p-0"
                                  title="Edit template"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  disabled={isDeletingTemplate === template.id}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title="Delete template"
                                >
                                  {isDeletingTemplate === template.id ? (
                                    <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Data Management */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                    <CardDescription>Export or import your journal data (entries, tags, templates, moods)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Encrypt Export</Label>
                          <p className="text-xs text-muted-foreground">
                            Add password protection to your export file
                          </p>
                        </div>
                        <Switch checked={encryptExport} onCheckedChange={setEncryptExport} />
                      </div>

                      {encryptExport && (
                        <div className="space-y-2">
                          <Label htmlFor="export-password">
                            Export Password <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="export-password"
                            type="password"
                            value={exportPassword}
                            onChange={(e) => setExportPassword(e.target.value)}
                            placeholder="Enter encryption password (min 8 characters)"
                            required
                            className={encryptExport && (!exportPassword || exportPassword.length < 8) ? "border-destructive" : ""}
                          />
                          {exportPassword && exportPassword.length < 8 && (
                            <p className="text-xs text-destructive">
                              Password must be at least 8 characters long
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            ⚠️ Remember this password! You'll need it to import the file.
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={handleExport}
                        variant="outline"
                        className="w-full"
                        disabled={encryptExport && (!exportPassword || exportPassword.length < 8)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export to JSON
                      </Button>

                      {/* Password Verification Dialog */}
                      <Dialog open={showExportPasswordDialog} onOpenChange={setShowExportPasswordDialog}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Verify Password</DialogTitle>
                            <DialogDescription>
                              Please enter your login password to export your data.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="export-login-password">Login Password</Label>
                              <Input
                                id="export-login-password"
                                type="password"
                                value={exportLoginPassword}
                                onChange={(e) => setExportLoginPassword(e.target.value)}
                                placeholder="Enter your login password"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !isVerifyingPassword) {
                                    handleExportPasswordSubmit();
                                  }
                                }}
                                autoFocus
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowExportPasswordDialog(false);
                                setExportLoginPassword('');
                              }}
                              disabled={isVerifyingPassword}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleExportPasswordSubmit}
                              disabled={isVerifyingPassword || !exportLoginPassword.trim()}
                            >
                              {isVerifyingPassword ? 'Verifying...' : 'Verify & Export'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="space-y-3 p-4 border rounded-lg">
                      {showImportPassword ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                            <Key className="h-4 w-4" />
                            <span className="text-sm font-medium">Encrypted File Detected</span>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="import-password">Decryption Password</Label>
                            <Input
                              id="import-password"
                              type="password"
                              value={importPassword}
                              onChange={(e) => setImportPassword(e.target.value)}
                              placeholder="Enter the password used during export"
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleEncryptedImport} className="flex-1">
                              <Upload className="h-4 w-4 mr-2" />
                              Import Encrypted File
                            </Button>
                            <Button
                              onClick={() => {
                                setShowImportPassword(false);
                                setImportPassword('');
                                delete (window as any).pendingJSONImport;
                              }}
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button asChild variant="outline" className="w-full">
                          <label className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-2 inline" />
                            Import from JSON
                            <input
                              type="file"
                              accept=".json"
                              onChange={handleImport}
                              className="hidden"
                            />
                          </label>
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Exports include entries, tags, templates, moods, and formatting with dates and times. Enable encryption for sensitive data.
                    </p>
                  </CardContent>
                </Card>

                {/* Reminders & Notifications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Reminders & Notifications
                    </CardTitle>
                    <CardDescription>Set up reminders to write in your journal</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h3 className="font-semibold">Create New Reminder</h3>
                      <div className="space-y-3">
                        <div className="space-y-3">
                          <Label>Notification Type</Label>
                          <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={newReminder.notificationType === 'email'}
                                disabled={false}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewReminder({
                                      ...newReminder,
                                      notificationType: 'email',
                                      webhookUrl: '',
                                      body: '',
                                      title: '',
                                      emailAddress: email || '',
                                    });
                                  } else {
                                    setNewReminder({
                                      ...newReminder,
                                      notificationType: null,
                                      emailAddress: '',
                                      body: '',
                                    });
                                  }
                                }}
                              />
                              <Label>Email</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={newReminder.notificationType === 'webhook'}
                                disabled={false}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewReminder({
                                      ...newReminder,
                                      notificationType: 'webhook',
                                      emailAddress: '',
                                      body: '',
                                      title: '',
                                      webhookUrl: '',
                                    });
                                  } else {
                                    setNewReminder({
                                      ...newReminder,
                                      notificationType: null,
                                      webhookUrl: '',
                                    });
                                  }
                                }}
                              />
                              <Label>Webhook</Label>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Select either Email or Webhook. Both are disabled by default.
                          </p>
                          {newReminder.notificationType === 'email' && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3">
                              <p className="text-xs text-amber-800 dark:text-amber-200">
                                <strong>Note:</strong> Email notifications require SMTP configuration via environment variables when running docker-compose.
                                Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in your .env.docker file.
                                See SMTP_CONFIG.md for details.
                              </p>
                            </div>
                          )}
                        </div>

                        {newReminder.notificationType && (
                          <>
                            <div className="space-y-2">
                              <Label>
                                {newReminder.notificationType === 'email' ? 'Reminder Title' : 'Message'}
                                <span className="text-destructive ml-1">*</span>
                              </Label>
                              <Input
                                placeholder={newReminder.notificationType === 'email' ? 'e.g., Morning Journal' : 'e.g., Time to write in your journal!'}
                                value={newReminder.title}
                                onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                                className={!newReminder.title.trim() ? 'border-destructive' : ''}
                              />
                            </div>

                            {newReminder.notificationType === 'email' && (
                              <>
                                <div className="space-y-2">
                                  <Label>Email Body</Label>
                                  <Textarea
                                    placeholder="Enter the email message body..."
                                    value={newReminder.body}
                                    onChange={(e) => setNewReminder({ ...newReminder, body: e.target.value })}
                                    rows={4}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>
                                    Email Address <span className="text-destructive ml-1">*</span>
                                  </Label>
                                  <Input
                                    type="email"
                                    placeholder="your.email@example.com"
                                    value={newReminder.emailAddress}
                                    onChange={(e) => setNewReminder({ ...newReminder, emailAddress: e.target.value })}
                                    className={!newReminder.emailAddress.trim() ? 'border-destructive' : ''}
                                  />
                                </div>
                              </>
                            )}

                            {newReminder.notificationType === 'webhook' && (
                              <div className="space-y-2">
                                <Label>
                                  Webhook URL <span className="text-destructive ml-1">*</span>
                                </Label>
                                <Input
                                  type="url"
                                  placeholder="https://example.com/webhook"
                                  value={newReminder.webhookUrl}
                                  onChange={(e) => setNewReminder({ ...newReminder, webhookUrl: e.target.value })}
                                  className={
                                    !newReminder.webhookUrl.trim() ||
                                    (newReminder.webhookUrl.trim() && !isValidWebhookUrl(newReminder.webhookUrl))
                                      ? 'border-destructive'
                                      : ''
                                  }
                                />
                                {newReminder.webhookUrl.trim() && !isValidWebhookUrl(newReminder.webhookUrl) && (
                                  <p className="text-xs text-destructive">
                                    The field did not contain a valid URL. URL must start with http:// or https://
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label>Time</Label>
                              <Input
                                type="time"
                                value={newReminder.time}
                                onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>
                                Days of Week <span className="text-destructive ml-1">*</span>
                              </Label>
                              <div className="flex gap-2 flex-wrap">
                                {dayNames.map((day, index) => (
                                  <Button
                                    key={index}
                                    type="button"
                                    variant={newReminder.daysOfWeek.includes(index) ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => toggleDayOfWeek(index, false)}
                                  >
                                    {day}
                                  </Button>
                                ))}
                              </div>
                              {newReminder.daysOfWeek.length === 0 && (
                                <p className="text-xs text-destructive">Please select at least one day</p>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={newReminder.isEnabled}
                                onCheckedChange={(checked) => setNewReminder({ ...newReminder, isEnabled: checked })}
                              />
                              <Label>Enable Reminder</Label>
                            </div>

                            <Button
                              onClick={handleCreateReminder}
                              disabled={isCreatingReminder || !isCreateReminderValid()}
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              {isCreatingReminder ? 'Creating...' : 'Create Reminder'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isLoadingReminders ? (
                      <div className="text-center py-8 text-muted-foreground">Loading reminders...</div>
                    ) : reminders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No reminders yet. Create your first reminder above!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Label>Your Reminders</Label>
                        {reminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className="border rounded-lg p-4 space-y-3"
                          >
                            {editingReminderId === reminder.id ? (
                              <>
                                <div className="space-y-2">
                                  <Label>
                                    {editingReminder.notificationType === 'email' ? 'Reminder Title' : 'Message'}
                                  </Label>
                                  <Input
                                    placeholder={editingReminder.notificationType === 'email' ? 'e.g., Morning Journal' : 'e.g., Time to write in your journal!'}
                                    value={editingReminder.title}
                                    onChange={(e) => setEditingReminder({ ...editingReminder, title: e.target.value })}
                                  />
                                </div>

                                {editingReminder.notificationType === 'email' && (
                                  <div className="space-y-2">
                                    <Label>Email Body</Label>
                                    <Textarea
                                      placeholder="Enter the email message body..."
                                      value={editingReminder.body}
                                      onChange={(e) => setEditingReminder({ ...editingReminder, body: e.target.value })}
                                      rows={4}
                                    />
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label>Time</Label>
                                  <Input
                                    type="time"
                                    value={editingReminder.time}
                                    onChange={(e) => setEditingReminder({ ...editingReminder, time: e.target.value })}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Days of Week</Label>
                                  <div className="flex gap-2 flex-wrap">
                                    {dayNames.map((day, index) => (
                                      <Button
                                        key={index}
                                        type="button"
                                        variant={editingReminder.daysOfWeek.includes(index) ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => toggleDayOfWeek(index, true)}
                                      >
                                        {day}
                                      </Button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <Label>Notification Type</Label>
                                  <div className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={editingReminder.notificationType === 'email'}
                                        disabled={false}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setEditingReminder({
                                              ...editingReminder,
                                              notificationType: 'email',
                                              webhookUrl: '',
                                              body: editingReminder.body || '',
                                              emailAddress: editingReminder.emailAddress || email || '',
                                            });
                                          }
                                        }}
                                      />
                                      <Label>Email</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={editingReminder.notificationType === 'webhook'}
                                        disabled={false}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setEditingReminder({
                                              ...editingReminder,
                                              notificationType: 'webhook',
                                              emailAddress: '',
                                              body: '',
                                            });
                                          }
                                        }}
                                      />
                                      <Label>Webhook</Label>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Select either Email or Webhook. Both are disabled by default.
                                  </p>
                                  {editingReminder.notificationType === 'email' && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3">
                                      <p className="text-xs text-amber-800 dark:text-amber-200">
                                        <strong>Note:</strong> Email notifications require SMTP configuration via environment variables when running docker-compose.
                                        Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in your .env.docker file.
                                        See SMTP_CONFIG.md for details.
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {editingReminder.notificationType === 'email' && (
                                  <div className="space-y-2">
                                    <Label>Email Address</Label>
                                    <Input
                                      type="email"
                                      value={editingReminder.emailAddress}
                                      onChange={(e) => setEditingReminder({ ...editingReminder, emailAddress: e.target.value })}
                                    />
                                  </div>
                                )}

                                {editingReminder.notificationType === 'webhook' && (
                                  <div className="space-y-2">
                                    <Label>
                                      Webhook URL <span className="text-destructive ml-1">*</span>
                                    </Label>
                                    <Input
                                      type="url"
                                      value={editingReminder.webhookUrl}
                                      onChange={(e) => setEditingReminder({ ...editingReminder, webhookUrl: e.target.value })}
                                      className={
                                        !editingReminder.webhookUrl.trim() ||
                                        (editingReminder.webhookUrl.trim() && !isValidWebhookUrl(editingReminder.webhookUrl))
                                          ? 'border-destructive'
                                          : ''
                                      }
                                    />
                                    {editingReminder.webhookUrl.trim() && !isValidWebhookUrl(editingReminder.webhookUrl) && (
                                      <p className="text-xs text-destructive">
                                        The field did not contain a valid URL. URL must start with http:// or https://
                                      </p>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={editingReminder.isEnabled}
                                    onCheckedChange={(checked) => setEditingReminder({ ...editingReminder, isEnabled: checked })}
                                  />
                                  <Label>Enable Reminder</Label>
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateReminder(reminder.id)}
                                    disabled={!isEditReminderValid()}
                                  >
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={handleCancelEditReminder}>
                                    Cancel
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold">{reminder.title}</h4>
                                      <Badge variant={reminder.isEnabled ? 'default' : 'secondary'}>
                                        {reminder.isEnabled ? 'Enabled' : 'Disabled'}
                                      </Badge>
                                      <Badge variant="outline">
                                        {reminder.notificationType === 'email' ? 'Email' : 'Webhook'}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {reminder.time} - {reminder.daysOfWeek.map(d => dayNames[d]).join(', ')}
                                    </p>
                                    {reminder.notificationType === 'email' && reminder.emailAddress && (
                                      <p className="text-xs text-muted-foreground mt-1">{reminder.emailAddress}</p>
                                    )}
                                    {reminder.notificationType === 'webhook' && reminder.webhookUrl && (
                                      <p className="text-xs text-muted-foreground mt-1 break-all">{reminder.webhookUrl}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStartEditReminder(reminder)}
                                      className="h-8 w-8 p-0"
                                      title="Edit reminder"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteReminder(reminder.id)}
                                      disabled={isDeletingReminder === reminder.id}
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                      title="Delete reminder"
                                    >
                                      {isDeletingReminder === reminder.id ? (
                                        <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="about" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      About
                    </CardTitle>
                    <CardDescription>Information about this application</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {/* Logo Section */}
                    <div className="flex justify-center">
                      <img
                        src="/favicon.svg"
                        alt="Journal App Logo"
                        className="h-24 w-24 drop-shadow-lg"
                      />
                    </div>

                    {/* App Description */}
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">Personal Journal</h3>
                      <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                        A modern, secure journaling application designed to help you capture your thoughts,
                        track your moods, and organize your daily reflections with ease.
                      </p>
                    </div>

                    {/* App Info Section */}
                    <div className="space-y-3 pt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Version</span>
                          <span className="font-medium">0.0.0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Source Code</span>
                          <a
                            href="https://github.com/koolboy145/private-journal/tree/main"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            GitHub
                          </a>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">License</span>
                          <a
                            href="https://github.com/koolboy145/private-journal/blob/main/LICENSE"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            MIT
                          </a>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Report Bugs</span>
                          <a
                            href="https://github.com/koolboy145/private-journal/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            Issues
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Features Section */}
                    <div className="space-y-3 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Available Features</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Create and manage multiple journal entries per day</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Rich text editor with markdown support</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Mood tracking with emoji selection</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Custom tags for organizing entries</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Entry templates for quick creation</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Reminder notifications via email or webhook</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Data export and import (JSON format)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Multiple themes and view modes (list, grid, timeline)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>Secure authentication and encrypted data storage</span>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
