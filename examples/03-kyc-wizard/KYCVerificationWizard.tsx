// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Stepper,
  Input,
  Select,
  FileUpload,
  Button,
  IconButton,
  Card,
  Modal,
  Badge,
  Spinner,
  Skeleton,
  Icon,
} from '@unlimit/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type StepId = 'personal-info' | 'document-upload' | 'selfie';
type StepStatus = 'pending' | 'active' | 'complete' | 'error';
type VerificationStatus = 'pending-review' | 'approved' | 'rejected' | null;

interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
}

interface PersonalInfoErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  address?: string;
}

interface UploadedFile {
  file: File;
  id: string;
}

interface SelfieFile {
  file: File;
  id: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'personal-info', label: 'Personal Info' },
  { id: 'document-upload', label: 'Document Upload' },
  { id: 'selfie', label: 'Selfie' },
];

const STEP_INDEX: Record<StepId, number> = {
  'personal-info': 0,
  'document-upload': 1,
  selfie: 2,
};

const NATIONALITY_OPTIONS = [
  { value: '', label: 'Select nationality' },
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'jp', label: 'Japan' },
  { value: 'other', label: 'Other' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function KYCVerificationWizard() {
  // ── Page-load state ──
  const [isPageLoading, setIsPageLoading] = useState(true);

  // ── Step state ──
  const [activeStep, setActiveStep] = useState<StepId>('personal-info');
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());
  const [stepErrors, setStepErrors] = useState<Set<StepId>>(new Set());

  // ── Submission / async state ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // ── Personal info state ──
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    address: '',
  });
  const [personalInfoErrors, setPersonalInfoErrors] = useState<PersonalInfoErrors>({});

  // ── Document upload state ──
  const [uploadedDoc, setUploadedDoc] = useState<UploadedFile | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [isConfirmingRemoveDoc, setIsConfirmingRemoveDoc] = useState(false);

  // ── Selfie state ──
  const [selfieFile, setSelfieFile] = useState<SelfieFile | null>(null);
  const [isSelfieUploading, setIsSelfieUploading] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);

  // ── Focus management ──
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // ── Simulate initial page load ──
  useEffect(() => {
    const timer = setTimeout(() => setIsPageLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // ── Announce step changes to screen readers ──
  useEffect(() => {
    if (!isPageLoading && liveRegionRef.current) {
      const stepLabel = STEPS.find((s) => s.id === activeStep)?.label ?? '';
      liveRegionRef.current.textContent = `Step ${STEP_INDEX[activeStep] + 1} of ${STEPS.length}: ${stepLabel}`;
    }
  }, [activeStep, isPageLoading]);

  // ── Focus step heading on step change ──
  useEffect(() => {
    if (!isPageLoading) {
      stepHeadingRef.current?.focus();
    }
  }, [activeStep, isPageLoading]);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const activeStepIndex = STEP_INDEX[activeStep];

  const stepStatusMap: Record<StepId, StepStatus> = {
    'personal-info':
      activeStep === 'personal-info'
        ? 'active'
        : stepErrors.has('personal-info')
        ? 'error'
        : completedSteps.has('personal-info')
        ? 'complete'
        : 'pending',
    'document-upload':
      activeStep === 'document-upload'
        ? 'active'
        : stepErrors.has('document-upload')
        ? 'error'
        : completedSteps.has('document-upload')
        ? 'complete'
        : 'pending',
    selfie:
      activeStep === 'selfie'
        ? 'active'
        : stepErrors.has('selfie')
        ? 'error'
        : completedSteps.has('selfie')
        ? 'complete'
        : 'pending',
  };

  const isPersonalInfoValid =
    personalInfo.firstName.trim() !== '' &&
    personalInfo.lastName.trim() !== '' &&
    personalInfo.dateOfBirth.trim() !== '' &&
    personalInfo.nationality !== '' &&
    personalInfo.address.trim() !== '';

  const isDocumentStepValid = uploadedDoc !== null;
  const isSelfieStepValid = selfieFile !== null;

  const isNextDisabled =
    (activeStep === 'personal-info' && !isPersonalInfoValid) ||
    (activeStep === 'document-upload' && !isDocumentStepValid) ||
    (activeStep === 'selfie' && !isSelfieStepValid) ||
    isSubmitting;

  const isBackDisabled = activeStepIndex === 0 || isSubmitting;

  const nextButtonLabel =
    activeStep === 'personal-info'
      ? 'Next: Document Upload'
      : activeStep === 'document-upload'
      ? 'Next: Selfie'
      : 'Submit Verification';

  const backButtonLabel =
    activeStep === 'document-upload'
      ? 'Back to Personal Info'
      : activeStep === 'selfie'
      ? 'Back to Document Upload'
      : 'Back';

  // ─── Handlers ────────────────────────────────────────────────────────────

  const validatePersonalInfo = (): boolean => {
    const errors: PersonalInfoErrors = {};
    if (!personalInfo.firstName.trim()) errors.firstName = 'First name is required.';
    if (!personalInfo.lastName.trim()) errors.lastName = 'Last name is required.';
    if (!personalInfo.dateOfBirth.trim()) errors.dateOfBirth = 'Date of birth is required.';
    if (!personalInfo.nationality) errors.nationality = 'Nationality is required.';
    if (!personalInfo.address.trim()) errors.address = 'Address is required.';
    setPersonalInfoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async () => {
    setGlobalError(null);

    if (activeStep === 'personal-info') {
      const valid = validatePersonalInfo();
      if (!valid) {
        setStepErrors((prev) => new Set(prev).add('personal-info'));
        return;
      }
      setStepErrors((prev) => { const s = new Set(prev); s.delete('personal-info'); return s; });
      setCompletedSteps((prev) => new Set(prev).add('personal-info'));
      setActiveStep('document-upload');
      return;
    }

    if (activeStep === 'document-upload') {
      if (!uploadedDoc) return;
      // Simulate async document upload
      setIsUploadingDoc(true);
      setUploadError(null);
      try {
        await simulateAsync(1500);
        setStepErrors((prev) => { const s = new Set(prev); s.delete('document-upload'); return s; });
        setCompletedSteps((prev) => new Set(prev).add('document-upload'));
        setActiveStep('selfie');
      } catch {
        setUploadError('Network error while uploading document. Please try again.');
        setStepErrors((prev) => new Set(prev).add('document-upload'));
      } finally {
        setIsUploadingDoc(false);
      }
      return;
    }

    if (activeStep === 'selfie') {
      if (!selfieFile) return;
      // Simulate async final submission
      setIsSubmitting(true);
      setSelfieError(null);
      try {
        await simulateAsync(2000);
        // Simulate a random outcome for demo purposes
        const outcomes: VerificationStatus[] = ['pending-review', 'approved', 'rejected'];
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        setVerificationStatus(outcome);
        if (outcome === 'rejected') {
          setRejectionReason(
            'We were unable to verify your identity. The document provided did not match the selfie. Please re-submit with a valid government-issued ID and a clear selfie.'
          );
        }
        setCompletedSteps((prev) => new Set(prev).add('selfie'));
      } catch {
        setGlobalError('Submission failed due to a server error. Please try again.');
        setStepErrors((prev) => new Set(prev).add('selfie'));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (activeStep === 'document-upload') setActiveStep('personal-info');
    if (activeStep === 'selfie') setActiveStep('document-upload');
    setGlobalError(null);
  };

  const handlePersonalInfoChange = (field: keyof PersonalInfo) => (value: string) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));
    if (personalInfoErrors[field]) {
      setPersonalInfoErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const handleDocFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setUploadedDoc({ file: files[0], id: crypto.randomUUID() });
    setUploadError(null);
  }, []);

  const handleSelfieFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setSelfieFile({ file: files[0], id: crypto.randomUUID() });
    setSelfieError(null);
  }, []);

  const confirmRemoveDoc = () => setIsConfirmingRemoveDoc(true);
  const cancelRemoveDoc = () => setIsConfirmingRemoveDoc(false);
  const executeRemoveDoc = async () => {
    setIsConfirmingRemoveDoc(false);
    setIsDeletingDoc(true);
    await simulateAsync(800);
    setUploadedDoc(null);
    setIsDeletingDoc(false);
  };

  const handleRestart = () => {
    setActiveStep('personal-info');
    setCompletedSteps(new Set());
    setStepErrors(new Set());
    setVerificationStatus(null);
    setRejectionReason('');
    setPersonalInfo({ firstName: '', lastName: '', dateOfBirth: '', nationality: '', address: '' });
    setPersonalInfoErrors({});
    setUploadedDoc(null);
    setSelfieFile(null);
    setGlobalError(null);
    setUploadError(null);
    setSelfieError(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Screen-reader live region for step announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        style={styles.srOnly}
      />

      <div style={styles.container}>
        {/* ── Page loading skeleton ── */}
        {isPageLoading ? (
          <div aria-busy="true" aria-label="Loading verification wizard">
            <Skeleton variant="rect" width="100%" height={48} />
            <div style={{ marginTop: 'var(--spacing-6)' }}>
              <Skeleton variant="rect" width="100%" height={320} />
            </div>
            <div style={{ marginTop: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-3)' }}>
              <Skeleton variant="rect" width={120} height={44} />
              <Skeleton variant="rect" width={120} height={44} />
            </div>
          </div>
        ) : verificationStatus !== null ? (
          // ── Verification status screen ──
          <VerificationStatusScreen
            status={verificationStatus}
            rejectionReason={rejectionReason}
            onRestart={handleRestart}
          />
        ) : (
          // ── Wizard ──
          <>
            {/* Stepper */}
            <div style={styles.stepperWrapper}>
              <Stepper
                steps={STEPS}
                current={activeStep}
                status={stepStatusMap}
              />
            </div>

            {/* Global error */}
            {globalError && (
              <div role="alert" style={styles.globalError}>
                <Icon name="alert" size="sm" aria-hidden={true} />
                <span>{globalError}</span>
              </div>
            )}

            {/* Step content */}
            <Card padding="md">
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                style={styles.stepHeading}
              >
                {activeStep === 'personal-info' && 'Step 1: Personal Information'}
                {activeStep === 'document-upload' && 'Step 2: Document Upload'}
                {activeStep === 'selfie' && 'Step 3: Selfie Verification'}
              </h2>

              {activeStep === 'personal-info' && (
                <PersonalInfoStep
                  values={personalInfo}
                  errors={personalInfoErrors}
                  onChange={handlePersonalInfoChange}
                />
              )}

              {activeStep === 'document-upload' && (
                <DocumentUploadStep
                  uploadedDoc={uploadedDoc}
                  isUploading={isUploadingDoc}
                  isDeletingDoc={isDeletingDoc}
                  uploadError={uploadError}
                  onFiles={handleDocFiles}
                  onRemove={confirmRemoveDoc}
                />
              )}

              {activeStep === 'selfie' && (
                <SelfieStep
                  selfieFile={selfieFile}
                  isUploading={isSelfieUploading}
                  selfieError={selfieError}
                  onFiles={handleSelfieFiles}
                />
              )}
            </Card>

            {/* Navigation */}
            <div style={styles.navRow}>
              <Button
                variant="secondary"
                size="lg"
                disabled={isBackDisabled}
                aria-disabled={isBackDisabled}
                onClick={isBackDisabled ? undefined : handleBack}
              >
                {backButtonLabel}
              </Button>

              <Button
                variant="primary"
                size="lg"
                disabled={isNextDisabled}
                aria-disabled={isNextDisabled}
                loading={isSubmitting || isUploadingDoc}
                onClick={isNextDisabled ? undefined : handleNext}
              >
                {nextButtonLabel}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Remove document confirmation modal */}
      <Modal
        open={isConfirmingRemoveDoc}
        onClose={cancelRemoveDoc}
        title="Remove Document"
      >
        <p style={styles.modalBody}>
          Are you sure you want to remove the uploaded document? You will need to upload a new one to proceed.
        </p>
        <div style={styles.modalActions}>
          <Button variant="secondary" size="md" onClick={cancelRemoveDoc}>
            Cancel
          </Button>
          <Button variant="destructive" size="md" onClick={executeRemoveDoc}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── Personal Info Step ──

interface PersonalInfoStepProps {
  values: PersonalInfo;
  errors: PersonalInfoErrors;
  onChange: (field: keyof PersonalInfo) => (value: string) => void;
}

function PersonalInfoStep({ values, errors, onChange }: PersonalInfoStepProps) {
  return (
    <div style={styles.formGrid}>
      <Input
        label="First Name"
        value={values.firstName}
        onChange={onChange('firstName')}
        placeholder="Enter your first name"
        type="text"
        required={true}
        error={errors.firstName}
      />
      <Input
        label="Last Name"
        value={values.lastName}
        onChange={onChange('lastName')}
        placeholder="Enter your last name"
        type="text"
        required={true}
        error={errors.lastName}
      />
      <Input
        label="Date of Birth"
        value={values.dateOfBirth}
        onChange={onChange('dateOfBirth')}
        placeholder="YYYY-MM-DD"
        type="text"
        required={true}
        error={errors.dateOfBirth}
      />
      <Select
        label="Nationality"
        value={values.nationality}
        onChange={onChange('nationality')}
        options={NATIONALITY_OPTIONS}
      />
      {errors.nationality && (
        <p role="alert" style={styles.selectError}>
          {errors.nationality}
        </p>
      )}
      <div style={styles.fullWidth}>
        <Input
          label="Residential Address"
          value={values.address}
          onChange={onChange('address')}
          placeholder="Enter your full address"
          type="text"
          required={true}
          error={errors.address}
        />
      </div>
    </div>
  );
}

// ── Document Upload Step ──

interface DocumentUploadStepProps {
  uploadedDoc: UploadedFile | null;
  isUploading: boolean;
  isDeletingDoc: boolean;
  uploadError: string | null;
  onFiles: (files: File[]) => void;
  onRemove: () => void;
}

function DocumentUploadStep({
  uploadedDoc,
  isUploading,
  isDeletingDoc,
  uploadError,
  onFiles,
  onRemove,
}: DocumentUploadStepProps) {
  return (
    <div style={styles.stepContent}>
      <p style={styles.stepDescription}>
        Upload a government-issued photo ID (passport, national ID card, or driver's licence).
        Accepted formats: PDF, JPG, PNG. Maximum size: 10 MB.
      </p>

      {/* Empty state — no file selected */}
      {!uploadedDoc && !isUploading && (
        <FileUpload
          accept={['application/pdf', 'image/jpeg', 'image/png']}
          maxSizeMb={10}
          multiple={false}
          onFiles={onFiles}
          error={uploadError ?? undefined}
          disabled={isUploading}
        />
      )}

      {/* Upload error */}
      {uploadError && !isUploading && (
        <div role="alert" style={styles.errorBanner}>
          <Icon name="alert" size="sm" aria-hidden={true} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Uploading spinner */}
      {isUploading && (
        <div style={styles.spinnerRow}>
          <Spinner size="md" label="Uploading document" />
          <span style={styles.spinnerLabel}>Uploading document…</span>
        </div>
      )}

      {/* Uploaded file row */}
      {uploadedDoc && !isUploading && (
        <div style={styles.fileRow} aria-label={`Uploaded file: ${uploadedDoc.file.name}`}>
          <Icon name="check" size="sm" aria-hidden={true} />
          <span style={styles.fileName}>{uploadedDoc.file.name}</span>
          <span style={styles.fileSize}>
            ({(uploadedDoc.file.size / 1024 / 1024).toFixed(2)} MB)
          </span>

          {isDeletingDoc ? (
            <Spinner size="sm" label="Removing document" />
          ) : (
            <IconButton
              variant="ghost"
              size="sm"
              icon={<Icon name="trash" size="sm" aria-hidden={true} />}
              aria-label={`Remove ${uploadedDoc.file.name}`}
              onClick={onRemove}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Selfie Step ──

interface SelfieStepProps {
  selfieFile: SelfieFile | null;
  isUploading: boolean;
  selfieError: string | null;
  onFiles: (files: File[]) => void;
}

function SelfieStep({ selfieFile, isUploading, selfieError, onFiles }: SelfieStepProps) {
  return (
    <div style={styles.stepContent}>
      <p style={styles.stepDescription}>
        Take or upload a clear selfie of your face. Make sure your face is fully visible,
        well-lit, and not obscured by glasses, hats, or masks. Accepted formats: JPG, PNG.
        Maximum size: 10 MB.
      </p>

      {/* Selfie upload error */}
      {selfieError && (
        <div role="alert" style={styles.errorBanner}>
          <Icon name="alert" size="sm" aria-hidden={true} />
          <span>{selfieError}</span>
        </div>
      )}

      {/* Uploading spinner */}
      {isUploading && (
        <div style={styles.spinnerRow}>
          <Spinner size="md" label="Uploading selfie" />
          <span style={styles.spinnerLabel}>Uploading selfie…</span>
        </div>
      )}

      {/* File picker — shown when no selfie yet */}
      {!selfieFile && !isUploading && (
        <FileUpload
          accept={['image/jpeg', 'image/png']}
          maxSizeMb={10}
          multiple={false}
          onFiles={onFiles}
          error={selfieError ?? undefined}
          disabled={isUploading}
        />
      )}

      {/* Uploaded selfie row */}
      {selfieFile && !isUploading && (
        <div style={styles.fileRow} aria-label={`Selfie uploaded: ${selfieFile.file.name}`}>
          <Icon name="check" size="sm" aria-hidden={true} />
          <span style={styles.fileName}>{selfieFile.file.name}</span>
          <span style={styles.fileSize}>
            ({(selfieFile.file.size / 1024 / 1024).toFixed(2)} MB)
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiles([])}
          >
            Change
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Verification Status Screen ──

interface VerificationStatusScreenProps {
  status: VerificationStatus;
  rejectionReason: string;
  onRestart: () => void;
}

function VerificationStatusScreen({ status, rejectionReason, onRestart }: VerificationStatusScreenProps) {
  const isApproved = status === 'approved';
  const isPending = status === 'pending-review';
  const isRejected = status === 'rejected';

  return (
    <Card padding="lg">
      <div style={styles.statusCard}>
        <h2 style={styles.statusHeading}>Verification Status</h2>

        <div style={styles.badgeRow}>
          {isPending && (
            <Badge variant="warning">Pending Review</Badge>
          )}
          {isApproved && (
            <Badge variant="success">Approved</Badge>
          )}
          {isRejected && (
            <Badge variant="danger">Rejected</Badge>
          )}
        </div>

        {isPending && (
          <p style={styles.statusMessage}>
            Your documents have been submitted and are currently under review. This typically
            takes 1–2 business days. We'll notify you by email once the review is complete.
          </p>
        )}

        {isApproved && (
          <div style={styles.approvedContent}>
            <Icon name="check" size="lg" aria-hidden={true} />
            <p style={styles.statusMessage}>
              Your identity has been successfully verified. You now have full access to all
              platform features.
            </p>
          </div>
        )}

        {isRejected && (
          <div style={styles.rejectedContent}>
            <div role="alert" style={styles.rejectionAlert}>
              <Icon name="alert" size="sm" aria-hidden={true} />
              <strong>Reason for rejection:</strong>
            </div>
            <p style={styles.rejectionReason}>{rejectionReason}</p>
            <p style={styles.statusMessage}>
              Please review the reason above and restart the verification process with the
              correct documents.
            </p>
          </div>
        )}

        {(isRejected || isPending) && (
          <div style={styles.restartRow}>
            <Button variant="primary" size="lg" onClick={onRestart}>
              {isRejected ? 'Restart Verification' : 'Return to Home'}
            </Button>
          </div>
        )}

        {isApproved && (
          <div style={styles.restartRow}>
            <Button variant="secondary" size="lg" onClick={onRestart}>
              Start New Verification
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function simulateAsync(ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 10% chance of simulated failure for demo
      if (Math.random() < 0.1) reject(new Error('Simulated network error'));
      else resolve();
    }, ms);
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--color-neutral-100)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 'var(--spacing-8) var(--spacing-4)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-foreground)',
  },
  container: {
    width: '100%',
    maxWidth: '640px',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-6)',
  },
  stepperWrapper: {
    overflowX: 'auto',
    paddingBottom: 'var(--spacing-1)',
  },
  stepHeading: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-semibold)' as unknown as number,
    lineHeight: 'var(--line-height-tight)',
    color: 'var(--color-neutral-900)',
    marginBottom: 'var(--spacing-6)',
    outline: 'none',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--spacing-4)',
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
  selectError: {
    gridColumn: '1 / -1',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-danger)',
    margin: '0',
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-4)',
  },
  stepDescription: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-muted-foreground)',
    lineHeight: 'var(--line-height-normal)',
    margin: '0 0 var(--spacing-2) 0',
  },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 'var(--spacing-3)',
  },
  globalError: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-3) var(--spacing-4)',
    backgroundColor: '#FEF2F2',
    border: '1px solid var(--color-danger)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-danger)',
    fontSize: 'var(--font-size-sm)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-3) var(--spacing-4)',
    backgroundColor: '#FEF2F2',
    border: '1px solid var(--color-danger)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-danger)',
    fontSize: 'var(--font-size-sm)',
  },
  spinnerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-3)',
    padding: 'var(--spacing-4)',
    backgroundColor: 'var(--color-neutral-100)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  spinnerLabel: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-muted-foreground)',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    padding: 'var(--spacing-3) var(--spacing-4)',
    backgroundColor: 'var(--color-neutral-100)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    flexWrap: 'wrap',
  },
  fileName: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)' as unknown as number,
    color: 'var(--color-neutral-900)',
    flex: 1,
    wordBreak: 'break-all',
  },
  fileSize: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-muted-foreground)',
  },
  modalBody: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-neutral-600)',
    lineHeight: 'var(--line-height-normal)',
    marginBottom: 'var(--spacing-6)',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--spacing-3)',
  },
  statusCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-4)',
    alignItems: 'flex-start',
  },
  statusHeading: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)' as unknown as number,
    color: 'var(--color-neutral-900)',
    margin: 0,
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
  },
  statusMessage: {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-neutral-600)',
    lineHeight: 'var(--line-height-normal)',
    margin: 0,
  },
  approvedContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-3)',
    color: 'var(--color-success)',
  },
  rejectedContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-3)',
    width: '100%',
  },
  rejectionAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    color: 'var(--color-danger)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)' as unknown as number,
  },
  rejectionReason: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-600)',
    lineHeight: 'var(--line-height-normal)',
    padding: 'var(--spacing-3) var(--spacing-4)',
    backgroundColor: '#FEF2F2',
    border: '1px solid var(--color-danger)',
    borderRadius: 'var(--radius-md)',
    margin: 0,
  },
  restartRow: {
    marginTop: 'var(--spacing-4)',
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
};
