// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Stepper,
  Card,
  Input,
  Select,
  FileUpload,
  Button,
  IconButton,
  Spinner,
  Skeleton,
  Badge,
  Modal,
  Icon,
} from '@unlimit/ui';
import styles from './KYCVerificationWizard.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type StepId = 'personal-info' | 'document-upload' | 'selfie';
type StepStatus = 'pending' | 'active' | 'complete' | 'error';
type VerificationStatus = 'idle' | 'pending' | 'approved' | 'rejected';

interface PersonalInfo {
  firstName: string;
  lastName: string;
  dob: string;
  country: string;
  address: string;
}

interface PersonalInfoErrors {
  firstName?: string;
  lastName?: string;
  dob?: string;
  country?: string;
  address?: string;
}

interface UploadedFile {
  file: File;
  id: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'personal-info', label: 'Personal Info' },
  { id: 'document-upload', label: 'Document Upload' },
  { id: 'selfie', label: 'Selfie' },
];

const STEP_ORDER: StepId[] = ['personal-info', 'document-upload', 'selfie'];

const COUNTRY_OPTIONS = [
  { value: '', label: 'Select country…' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function KYCVerificationWizard() {
  // ── Page-load state ──────────────────────────────────────────────────────
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    // Simulate async initialisation (e.g. fetching existing draft)
    const timer = setTimeout(() => setIsPageLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // ── Step state ───────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState<StepId>('personal-info');
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());
  const [stepErrors, setStepErrors] = useState<Partial<Record<StepId, boolean>>>({}); // step-level error flag

  // ── Submission / global error state ──────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // ── Personal info state ──────────────────────────────────────────────────
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    dob: '',
    country: '',
    address: '',
  });
  const [personalInfoErrors, setPersonalInfoErrors] = useState<PersonalInfoErrors>({});

  // ── Document upload state ─────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Selfie state ──────────────────────────────────────────────────────────
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Focus management ─────────────────────────────────────────────────────
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isPageLoading && stepHeadingRef.current) {
      stepHeadingRef.current.focus();
    }
  }, [activeStep, isPageLoading]);

  // ── Cleanup camera on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const currentStepIndex = STEP_ORDER.indexOf(activeStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;

  const buildStepStatus = (): Record<StepId, StepStatus> => {
    const map = {} as Record<StepId, StepStatus>;
    STEP_ORDER.forEach((id) => {
      if (id === activeStep) {
        map[id] = stepErrors[id] ? 'error' : 'active';
      } else if (completedSteps.has(id)) {
        map[id] = 'complete';
      } else {
        map[id] = 'pending';
      }
    });
    return map;
  };

  // ─── Validation ──────────────────────────────────────────────────────────

  const validatePersonalInfo = (): boolean => {
    const errors: PersonalInfoErrors = {};
    if (!personalInfo.firstName.trim()) errors.firstName = 'First name is required.';
    if (!personalInfo.lastName.trim()) errors.lastName = 'Last name is required.';
    if (!personalInfo.dob) errors.dob = 'Date of birth is required.';
    if (!personalInfo.country) errors.country = 'Country is required.';
    if (!personalInfo.address.trim()) errors.address = 'Address is required.';
    setPersonalInfoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isStepValid = (): boolean => {
    if (activeStep === 'personal-info') {
      return (
        !!personalInfo.firstName.trim() &&
        !!personalInfo.lastName.trim() &&
        !!personalInfo.dob &&
        !!personalInfo.country &&
        !!personalInfo.address.trim()
      );
    }
    if (activeStep === 'document-upload') {
      return uploadedFiles.length > 0;
    }
    if (activeStep === 'selfie') {
      return selfieDataUrl !== null;
    }
    return false;
  };

  // ─── Navigation ──────────────────────────────────────────────────────────

  const handleBack = () => {
    if (isFirstStep) return;
    stopCamera();
    setActiveStep(STEP_ORDER[currentStepIndex - 1]);
  };

  const handleNext = async () => {
    if (activeStep === 'personal-info') {
      const valid = validatePersonalInfo();
      if (!valid) {
        setStepErrors((prev) => ({ ...prev, 'personal-info': true }));
        return;
      }
      setStepErrors((prev) => ({ ...prev, 'personal-info': false }));
    }

    if (!isLastStep) {
      setCompletedSteps((prev) => new Set(prev).add(activeStep));
      setActiveStep(STEP_ORDER[currentStepIndex + 1]);
      return;
    }

    // Final submit
    await handleSubmit();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setGlobalError(null);
    try {
      // Simulate API call
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          // Randomly simulate outcomes for demo purposes
          const rand = Math.random();
          if (rand < 0.1) reject(new Error('Network error. Please try again.'));
          else resolve();
        }, 2000);
      });
      setCompletedSteps((prev) => new Set(prev).add('selfie'));
      // Simulate backend verification result
      const rand = Math.random();
      if (rand < 0.5) {
        setVerificationStatus('pending');
      } else if (rand < 0.8) {
        setVerificationStatus('approved');
      } else {
        setVerificationStatus('rejected');
        setRejectionReason(
          'We were unable to verify your identity. The document provided did not match the information submitted. Please re-submit with a valid government-issued ID.'
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setGlobalError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── File upload ──────────────────────────────────────────────────────────

  const handleFiles = (files: File[]) => {
    setUploadError(null);
    const accepted: UploadedFile[] = [];
    for (const file of files) {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        setUploadError(`"${file.name}" has an unsupported file type. Please upload PDF, JPG, or PNG.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 10 MB size limit.`);
        return;
      }
      accepted.push({ file, id: `${file.name}-${Date.now()}` });
    }
    setUploadedFiles((prev) => [...prev, ...accepted]);
  };

  const handleRemoveFile = (id: string, name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    // Announce removal
    const liveRegion = document.getElementById('file-removal-live');
    if (liveRegion) liveRegion.textContent = `${name} removed.`;
  };

  // ─── Camera / Selfie ──────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setIsCameraLoading(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch {
      setCameraError(
        'Camera access was denied or is unavailable. Please allow camera permissions and try again.'
      );
    } finally {
      setIsCameraLoading(false);
    }
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setSelfieDataUrl(dataUrl);
    stopCamera();
  };

  const retakeSelfie = () => {
    setSelfieDataUrl(null);
    setCameraError(null);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderPersonalInfoStep = () => (
    <div className={styles.stepContent}>
      <p className={styles.stepDescription}>
        Please provide your personal details exactly as they appear on your government-issued ID.
      </p>
      <div className={styles.formGrid}>
        <Input
          label="First Name"
          value={personalInfo.firstName}
          onChange={(v) => setPersonalInfo((p) => ({ ...p, firstName: v }))}
          placeholder="Jane"
          required
          error={personalInfoErrors.firstName}
        />
        <Input
          label="Last Name"
          value={personalInfo.lastName}
          onChange={(v) => setPersonalInfo((p) => ({ ...p, lastName: v }))}
          placeholder="Doe"
          required
          error={personalInfoErrors.lastName}
        />
        <Input
          label="Date of Birth"
          value={personalInfo.dob}
          onChange={(v) => setPersonalInfo((p) => ({ ...p, dob: v }))}
          placeholder="YYYY-MM-DD"
          type="text"
          required
          error={personalInfoErrors.dob}
        />
        <Select
          label="Country of Residence"
          value={personalInfo.country}
          onChange={(v) => setPersonalInfo((p) => ({ ...p, country: v }))}
          options={COUNTRY_OPTIONS}
        />
        {personalInfoErrors.country && (
          <p role="alert" className={styles.fieldError}>
            {personalInfoErrors.country}
          </p>
        )}
        <div className={styles.fullWidth}>
          <Input
            label="Residential Address"
            value={personalInfo.address}
            onChange={(v) => setPersonalInfo((p) => ({ ...p, address: v }))}
            placeholder="123 Main St, City, State, ZIP"
            required
            error={personalInfoErrors.address}
          />
        </div>
      </div>
    </div>
  );

  const renderDocumentUploadStep = () => (
    <div className={styles.stepContent}>
      <p className={styles.stepDescription}>
        Upload a clear photo or scan of your government-issued ID (passport, driver's licence, or
        national ID card).
      </p>
      <FileUpload
        accept={['application/pdf', 'image/jpeg', 'image/png']}
        maxSizeMb={10}
        multiple={false}
        onFiles={handleFiles}
        error={uploadError ?? undefined}
      />

      {/* File upload empty state */}
      {uploadedFiles.length === 0 && !uploadError && (
        <p className={styles.uploadHint} aria-live="polite">
          No document selected yet. Drag and drop or click above to browse.
        </p>
      )}

      {/* File upload success state */}
      {uploadedFiles.length > 0 && (
        <ul className={styles.fileList} aria-label="Uploaded documents">
          {uploadedFiles.map(({ file, id }) => (
            <li key={id} className={styles.fileItem}>
              <Icon name="check" size="sm" aria-hidden="true" />
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
              <IconButton
                variant="ghost"
                size="sm"
                icon={<Icon name="x" size="sm" aria-hidden="true" />}
                aria-label={`Remove ${file.name}`}
                onClick={() => handleRemoveFile(id, file.name)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Accessible live region for file removal announcements */}
      <span
        id="file-removal-live"
        role="status"
        aria-live="polite"
        className={styles.srOnly}
      />
    </div>
  );

  const renderSelfieStep = () => (
    <div className={styles.stepContent}>
      <p className={styles.stepDescription}>
        Take a clear selfie so we can match your face to your ID document. Ensure good lighting and
        look directly at the camera.
      </p>

      {/* Selfie preview (success) */}
      {selfieDataUrl && (
        <div className={styles.selfiePreviewWrapper}>
          <img
            src={selfieDataUrl}
            alt="Selfie preview — your captured photo"
            className={styles.selfiePreview}
          />
          <Button variant="secondary" onClick={retakeSelfie}>
            Retake Selfie
          </Button>
        </div>
      )}

      {/* Camera loading state */}
      {isCameraLoading && (
        <div className={styles.cameraPlaceholder} role="status" aria-live="polite">
          <Spinner size="lg" label="Camera initialising, please wait" />
          <p className={styles.cameraHint}>Initialising camera…</p>
        </div>
      )}

      {/* Camera error state */}
      {cameraError && (
        <div role="alert" className={styles.cameraError}>
          <Icon name="alert" size="md" aria-hidden="true" />
          <p>{cameraError}</p>
          <Button variant="secondary" onClick={startCamera}>
            Retry Camera
          </Button>
        </div>
      )}

      {/* Camera active viewfinder */}
      {isCameraActive && !selfieDataUrl && (
        <div className={styles.cameraWrapper}>
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            aria-label="Camera viewfinder"
            muted
            playsInline
          />
          <Button
            variant="primary"
            aria-label="Take selfie"
            onClick={captureSelfie}
          >
            Take Selfie
          </Button>
        </div>
      )}

      {/* Camera not yet started */}
      {!isCameraActive && !isCameraLoading && !cameraError && !selfieDataUrl && (
        <div className={styles.cameraPlaceholder}>
          <Button
            variant="secondary"
            aria-label="Start camera to take selfie"
            onClick={startCamera}
          >
            Start Camera
          </Button>
          <p className={styles.cameraHint}>
            Your camera will activate when you click the button above.
          </p>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />
    </div>
  );

  const renderVerificationStatus = () => {
    const isPending = verificationStatus === 'pending';
    const isApproved = verificationStatus === 'approved';
    const isRejected = verificationStatus === 'rejected';

    return (
      <div className={styles.statusWrapper}>
        <h2 className={styles.statusHeading}>Verification Status</h2>

        {/* Pending state */}
        {isPending && (
          <div className={styles.statusCard}>
            <Badge variant="warning">Pending Review</Badge>
            <p className={styles.statusMessage}>
              Your documents are under review. This typically takes 1–2 business days. We'll notify
              you by email once a decision has been made.
            </p>
            <Spinner size="sm" label="Verification in progress" />
          </div>
        )}

        {/* Approved state */}
        {isApproved && (
          <div className={styles.statusCard}>
            <div className={styles.statusIconRow}>
              <Icon name="check" size="lg" aria-hidden="true" />
              <Badge variant="success">Approved</Badge>
            </div>
            <p className={styles.statusMessage}>
              Your identity has been successfully verified. You now have full access to your
              account.
            </p>
          </div>
        )}

        {/* Rejected state */}
        {isRejected && (
          <div
            className={styles.statusCard}
            role="alert"
            aria-live="polite"
            aria-label="Verification rejected"
          >
            <div className={styles.statusIconRow}>
              <Icon name="alert" size="lg" aria-hidden="true" />
              <Badge variant="danger">Rejected</Badge>
            </div>
            <p className={styles.statusMessage}>
              Unfortunately, your verification was unsuccessful.
            </p>
            {rejectionReason && (
              <div className={styles.rejectionReason}>
                <strong>Reason:</strong>
                <p>{rejectionReason}</p>
              </div>
            )}
            <Button
              variant="primary"
              onClick={() => {
                setVerificationStatus('idle');
                setActiveStep('personal-info');
                setCompletedSteps(new Set());
                setUploadedFiles([]);
                setSelfieDataUrl(null);
                setRejectionReason('');
              }}
            >
              Restart Verification
            </Button>
          </div>
        )}
      </div>
    );
  };

  const getNextLabel = () => {
    if (isLastStep) return 'Submit';
    const nextStep = STEPS[currentStepIndex + 1];
    return `Next: ${nextStep.label}`;
  };

  const getBackLabel = () => {
    if (isFirstStep) return 'Back';
    const prevStep = STEPS[currentStepIndex - 1];
    return `Back to ${prevStep.label}`;
  };

  const getStepHeading = () => {
    switch (activeStep) {
      case 'personal-info': return 'Step 1: Personal Information';
      case 'document-upload': return 'Step 2: Document Upload';
      case 'selfie': return 'Step 3: Selfie';
    }
  };

  // ─── Page loading skeleton ────────────────────────────────────────────────

  if (isPageLoading) {
    return (
      <main
        className={styles.root}
        aria-label="KYC Verification"
        aria-busy="true"
      >
        <div className={styles.skeletonWrapper}>
          <Skeleton variant="rect" width="100%" height={56} />
          <Skeleton variant="rect" width="100%" height={400} />
          <div className={styles.skeletonNav}>
            <Skeleton variant="rect" width={120} height={44} />
            <Skeleton variant="rect" width={120} height={44} />
          </div>
        </div>
      </main>
    );
  }

  // ─── Verification result screen ───────────────────────────────────────────

  const showStatusScreen = verificationStatus !== 'idle';

  return (
    <main className={styles.root} aria-label="KYC Verification">
      {/* Global submitting overlay */}
      {isSubmitting && (
        <div
          className={styles.submittingOverlay}
          role="status"
          aria-live="polite"
          aria-label="Submitting your information"
        >
          <Spinner size="lg" label="Submitting your information" />
          <p className={styles.submittingText}>Submitting your information…</p>
        </div>
      )}

      {/* Global error modal */}
      <Modal
        open={!!globalError}
        onClose={() => setGlobalError(null)}
        title="Submission Error"
      >
        <div role="alert" className={styles.modalErrorContent}>
          <Icon name="alert" size="md" aria-hidden="true" />
          <p>{globalError}</p>
          <Button variant="primary" onClick={() => setGlobalError(null)}>
            Dismiss
          </Button>
        </div>
      </Modal>

      <div className={styles.wizardContainer}>
        {/* Step indicator */}
        {!showStatusScreen && (
          <div className={styles.stepperWrapper}>
            <Stepper
              steps={STEPS}
              current={activeStep}
              status={buildStepStatus()}
            />
          </div>
        )}

        {/* Verification status screen */}
        {showStatusScreen ? (
          <Card padding="lg">
            {renderVerificationStatus()}
          </Card>
        ) : (
          <Card padding="lg">
            {/* Step heading — receives focus on step change */}
            <h1
              ref={stepHeadingRef}
              tabIndex={-1}
              className={styles.stepHeading}
            >
              {getStepHeading()}
            </h1>

            {/* Step content */}
            {activeStep === 'personal-info' && renderPersonalInfoStep()}
            {activeStep === 'document-upload' && renderDocumentUploadStep()}
            {activeStep === 'selfie' && renderSelfieStep()}

            {/* Navigation */}
            <div className={styles.navRow}>
              <Button
                variant="secondary"
                disabled={isFirstStep}
                aria-label={getBackLabel()}
                onClick={handleBack}
              >
                {getBackLabel()}
              </Button>
              <Button
                variant="primary"
                disabled={!isStepValid() || isSubmitting}
                loading={isSubmitting}
                aria-label={isSubmitting ? 'Submitting your information' : getNextLabel()}
                onClick={handleNext}
              >
                {isSubmitting ? 'Submitting…' : getNextLabel()}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
