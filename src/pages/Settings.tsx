import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, entries } from '@/lib/api';
import { toast } from 'sonner';
import { Moon, Sun, Download, Upload, Key, User } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [encryptExport, setEncryptExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  
  // Autosave preference
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem('autosave_enabled');
    return saved !== null ? JSON.parse(saved) : true; // Default: enabled
  });

  const handleAutosaveToggle = (checked: boolean) => {
    setAutosaveEnabled(checked);
    localStorage.setItem('autosave_enabled', JSON.stringify(checked));
    toast.success(`Autosave ${checked ? 'enabled' : 'disabled'}`);
  };

  const handlePasswordChange = async () => {
    if (!user) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
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
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;

    // Validate password if encryption is enabled
    if (encryptExport && !exportPassword) {
      toast.error('Please enter an encryption password');
      return;
    }

    if (encryptExport && exportPassword.length < 8) {
      toast.error('Encryption password must be at least 8 characters');
      return;
    }

    try {
      const csv = await entries.exportCSV(encryptExport ? exportPassword : undefined);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `journal-export${encryptExport ? '-encrypted' : ''}-${new Date().toISOString().split('T')[0]}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (encryptExport) {
        toast.success('Entries exported and encrypted successfully');
        setExportPassword(''); // Clear password after export
      } else {
        toast.success('Entries exported successfully');
      }
    } catch (error) {
      toast.error('Failed to export entries');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string;
        
        // Check if file is encrypted
        if (csv.startsWith('ENCRYPTED:')) {
          setShowImportPassword(true);
          // Store the CSV content for later processing
          (window as any).pendingCSVImport = csv;
          toast.info('This file is encrypted. Please enter the password.');
          return;
        }
        
        // Not encrypted, import directly
        const result = await entries.importCSV(csv);
        
        if (result.skipped > 0) {
          toast.success(`${result.message}`);
        } else {
          toast.success(`Imported ${result.count} entries successfully`);
        }
        
        window.location.reload(); // Refresh to show new entries
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to import entries. Please check the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleEncryptedImport = async () => {
    if (!importPassword) {
      toast.error('Please enter the decryption password');
      return;
    }

    try {
      const csv = (window as any).pendingCSVImport;
      if (!csv) {
        toast.error('No file to import');
        return;
      }

      const result = await entries.importCSV(csv, importPassword);
      
      if (result.skipped > 0) {
        toast.success(`${result.message}`);
      } else {
        toast.success(`Imported ${result.count} entries successfully`);
      }
      
      // Clean up
      delete (window as any).pendingCSVImport;
      setShowImportPassword(false);
      setImportPassword('');
      
      window.location.reload(); // Refresh to show new entries
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to decrypt or import file');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Your current account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={user?.username} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            Appearance & Preferences
          </CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark theme
              </p>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </div>
          
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

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or import your journal entries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export Section */}
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
                <Label htmlFor="export-password">Export Password</Label>
                <Input
                  id="export-password"
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="Enter encryption password (min 8 characters)"
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Remember this password! You'll need it to import the file.
                </p>
              </div>
            )}
            
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export to CSV
            </Button>
          </div>

          {/* Import Section */}
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
                      delete (window as any).pendingCSVImport;
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
                  Import from CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Exports include Markdown formatting. Enable encryption for sensitive data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
