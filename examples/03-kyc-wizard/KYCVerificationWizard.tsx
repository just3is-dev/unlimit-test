import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Stepper,
  Input,
  FileUpload,
  Button,
  Spinner,
  Skeleton,
  Card,
  Badge,
  Modal,
  Icon,
} from '@unlimit/ui';
import styles from './KYCVerificationWizard.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type StepId = 'personal' | 'document' | 'selfie';
type StepStatus = 'pending' | 'active' | 'complete' | 'error';
type VerificationStatus = 'pending_review' | 'approved' | 'rejected' | null;

interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  postalCode: string;
}

interface PersonalInfoErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

interface KYCVerificationWizardProps {
  /** Called when the wizard completes successfully */
  onComplete?: (status: VerificationStatus) => void;
  /** Called when the user cancels/discards the wizard */
  onDiscard?: () => void;
  /** Simulate initial data loading (e.g. pre-fill from profile) */
  initialLoading?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'personal', label: 'Personal Info' },
  { id: 'document', label: 'Document Upload' },
  { id: 'selfie', label: 'Selfie' },
];

const STEP_INDEX: Record<StepId, number> = {
  personal: 0,
  document: 1,
  selfie: 2,
};

// ─── Component ───────────────────────────────────────────────────────────────

export const KYCVerificationWizard: React.FC<KYCVerificationWizardProps> = ({
  onComplete,
  onDiscard,
  initialLoading = false,
}) => {
  // ── Wizard-level state ──
  const [currentStep, setCurrentStep] = useState<StepId>('personal');
  const [stepStatuses, setStepStatuses] = useState<Record<StepId, StepStatus>>({
    personal: 'active',
    document: 'pending',
    selfie: 'pending',
  });
  const [isInitialLoading, setIsInitialLoading] = useState(initialLoading);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // ── Step 1: Personal Info ──
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    address: '',
    city: '',
    postalCode: '',
  });
  const [personalErrors, setPersonalErrors] = useState<PersonalInfoErrors>({});

  // ── Step 2: Document Upload ──
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | undefined>(undefined);

  // ── Step 3: Selfie ──
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [selfieLoading, setSelfieLoading] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Accessibility: focus management & live region ──
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Simulate initial data load
  useEffect(() => {
    if (initialLoading) {
      const t = setTimeout(() => setIsInitialLoading(false), 1500);
      return () => clearTimeout(t);
    }
  }, [initialLoading]);

  // Focus step heading on step change
  useEffect(() => {
    if (!isInitialLoading) {
      stepHeadingRef.current?.focus();
    }
  }, [currentStep, isInitialLoading]);

  // Stop camera stream when leaving selfie step
  useEffect(() => {
    if (currentStep !== 'selfie' && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [currentStep]);

  // ── Helpers ──

  const announceStep = (stepId: StepId) => {
    const idx = STEP_INDEX[stepId];
    const label = STEPS[idx].label;
    setLiveAnnouncement(`Step ${idx + 1} of ${STEPS.length}: ${label}`);
  };

  const updateStepStatus = (id: StepId, status: StepStatus) => {
    setStepStatuses((prev) => ({ ...prev, [id]: status }));
  };

  // ── Step 1 Validation ──

  const validatePersonalInfo = (): boolean => {
    const errors: PersonalInfoErrors = {};
    if (!personalInfo.firstName.trim()) errors.firstName = 'First name is required.';
    if (!personalInfo.lastName.trim()) errors.lastName = 'Last name is required.';
    if (!personalInfo.dateOfBirth.trim()) errors.dateOfBirth = 'Date of birth is required.';
    if (!personalInfo.address.trim()) errors.address = 'Address is required.';
    if (!personalInfo.city.trim()) errors.city = 'City is required.';
    if (!personalInfo.postalCode.trim()) errors.postalCode = 'Postal code is required.';
    setPersonalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Navigation ──

  const goToStep = (stepId: StepId) => {
    setCurrentStep(stepId);
    setStepError(null);
    updateStepStatus(stepId, 'active');
    announceStep(stepId);
  };

  const handleBack = () => {
    const idx = STEP_INDEX[currentStep];
    if (idx === 0) return;
    const prevStep = STEPS[idx - 1].id;
    goToStep(prevStep);
  };

  const handleNext = async () => {
    setStepError(null);
    const idx = STEP_INDEX[currentStep];

    if (currentStep === 'personal') {
      if (!validatePersonalInfo()) return;
      setIsSubmitting(true);
      try {
        await simulateStepSubmit();
        updateStepStatus('personal', 'complete');
        goToStep('document');
      } catch (e) {
        updateStepStatus('personal', 'error');
        setStepError('Failed to save personal information. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (currentStep === 'document') {
      if (uploadedFiles.length === 0) {
        setFileError('Please upload a document before continuing.');
        return;
      }
      setIsSubmitting(true);
      try {
        await simulateStepSubmit();
        updateStepStatus('document', 'complete');
        goToStep('selfie');
      } catch (e) {
        updateStepStatus('document', 'error');
        setStepError('Failed to upload document. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (currentStep === 'selfie') {
      if (!selfieDataUrl) {
        setSelfieError('Please capture a selfie before submitting.');
        return;
      }
      setIsSubmitting(true);
      try {
        await simulateStepSubmit();
        updateStepStatus('selfie', 'complete');
        // Simulate verification result
        const result = await simulateVerification();
        setVerificationStatus(result.status);
        if (result.status === 'rejected') {
          setRejectionReason(result.reason ?? 'Your documents could not be verified.');
        }
        onComplete?.(result.status);
      } catch (e: any) {
        if (e?.message === 'SESSION_EXPIRED') {
          setWizardError('Your session has expired. Please refresh the page and try again.');
        } else {
          updateStepStatus('selfie', 'error');
          setStepError('Submission failed. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // ── Camera (Selfie Step) ──

  const startCamera = useCallback(async () => {
    setSelfieError(null);
    setSelfieLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setSelfieError(
        'Camera access was denied or is unavailable. Please allow camera permissions and try again.',
      );
    } finally {
      setSelfieLoading(false);
    }
  }, []);

  const captureSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setSelfieDataUrl(dataUrl);
    setSelfieError(null);
    // Stop stream after capture
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const retakeSelfie = () => {
    setSelfieDataUrl(null);
    startCamera();
  };

  // ── File Handling ──

  const handleFiles = (files: File[]) => {
    setFileError(undefined);
    setUploadedFiles(files);
    setLiveAnnouncement(
      files.length > 0
        ? `${files.length} file${files.length > 1 ? 's' : ''} selected: ${files.map((f) => f.name).join(', ')}`
        : 'No files selected.',
    );
  };

  // ── Discard Modal ──

  const handleDiscardConfirm = () => {
    setShowDiscardModal(false);
    onDiscard?.();
  };

  // ── Simulated async helpers ──

  const simulateStepSubmit = (): Promise<void> =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        // 10% chance of failure for demo
        Math.random() < 0.1 ? reject(new Error('NETWORK_ERROR')) : resolve();
      }, 1200);
    });

  const simulateVerification = (): Promise<{ status: VerificationStatus; reason?: string }> =>
    new Promise((resolve) => {
      setTimeout(() => {
        const roll = Math.random();
        if (roll < 0.6) resolve({ status: 'pending_review' });
        else if (roll < 0.85) resolve({ status: 'approved' });
        else resolve({ status: 'rejected', reason: 'The provided ID document could not be verified. Please ensure the document is valid and not expired.' });
      }, 1800);
    });

  // ── Derived ──

  const currentStepIndex = STEP_INDEX[currentStep];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const isComplete = verificationStatus !== null;

  const nextButtonLabel = isLastStep
    ? 'Submit Verification'
    : `Next: ${STEPS[currentStepIndex + 1].label}`;

  const isNextDisabled =
    isSubmitting ||
    (currentStep === 'document' && uploadedFiles.length === 0) ||
    (currentStep === 'selfie' && !selfieDataUrl && !selfieLoading);

  // ─── Render ───────────────────────────────────────────────────────────────

  // Wizard-level unrecoverable error
  if (wizardError) {
    return (
      <div className={styles.wizardContainer} role="alert">
        <Card padding="lg">
          <div className={styles.statusContent}>
            <Icon name="alert" size="lg" aria-hidden="true" />
            <h1 className={styles.statusTitle}>Something went wrong</h1>
            <p className={styles.statusDescription}>{wizardError}</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Initial loading skeleton
  if (isInitialLoading) {
    return (
      <div className={styles.wizardContainer} aria-busy="true" aria-label="Loading verification wizard">
        <div className={styles.skeletonWrapper}>
          <Skeleton variant="rect" width="100%" height={56} />
          <Skeleton variant="rect" width="100%" height={400} />
          <div className={styles.skeletonButtons}>
            <Skeleton variant="rect" width={120} height={44} />
            <Skeleton variant="rect" width={160} height={44} />
          </div>
        </div>
      </div>
    );
  }

  // Verification result screen
  if (isComplete) {
    return (
      <div className={styles.wizardContainer}>
        <Card padding="lg">
          <div className={styles.statusContent}>
            {verificationStatus === 'approved' && (
              <>
                <div className={styles.statusIconRow}>
                  <Icon name="check" size="lg" aria-hidden="true" />
                </div>
                <h1 className={styles.statusTitle}>Verification Approved</h1>
                <Badge variant="success">Approved</Badge>
                <p className={styles.statusDescription}>
                  Your identity has been successfully verified. You now have full access to your account.
                </p>
                <Button variant="primary" onClick={() => onComplete?.('approved')}>
                  Continue to Dashboard
                </Button>
              </>
            )}
            {verificationStatus === 'pending_review' && (
              <>
                <div className={styles.statusIconRow}>
                  <Icon name="info" size="lg" aria-hidden="true" />
                </div>
                <h1 className={styles.statusTitle}>Verification Pending Review</h1>
                <Badge variant="warning">Pending Review</Badge>
                <p className={styles.statusDescription}>
                  Your documents have been submitted and are currently under review. This typically takes 1–2 business days. We'll notify you by email once the review is complete.
                </p>
                <div className={styles.pendingSpinner}>
                  <Spinner size="md" label="Awaiting review" />
                </div>
              </>
            )}
            {verificationStatus === 'rejected' && (
              <>
                <div className={styles.statusIconRow}>
                  <Icon name="alert" size="lg" aria-hidden="true" />
                </div>
                <h1 className={styles.statusTitle}>Verification Rejected</h1>
                <Badge variant="danger">Rejected</Badge>
                <p className={styles.statusDescription}>
                  Unfortunately, your verification was not successful.
                </p>
                {rejectionReason && (
                  <div className={styles.rejectionReason} role="alert">
                    <strong>Reason: </strong>{rejectionReason}
                  </div>
                )}
                <Button
                  variant="primary"
                  onClick={() => {
                    setVerificationStatus(null);
                    setCurrentStep('personal');
                    setStepStatuses({ personal: 'active', document: 'pending', selfie: 'pending' });
                    setUploadedFiles([]);
                    setSelfieDataUrl(null);
                    setStepError(null);
                  }}
                >
                  Restart Verification
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={styles.wizardContainer}
      aria-busy={isSubmitting}
    >
      {/* Accessible live region for step announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {liveAnnouncement}
      </div>

      {/* Step Indicator */}
      <div className={styles.stepperWrapper}>
        <Stepper
          steps={STEPS}
          current={currentStep}
          status={stepStatuses}
        />
      </div>

      {/* Step Content Card */}
      <Card padding="lg">
        {/* Step-level error banner */}
        {stepError && (
          <div className={styles.stepErrorBanner} role="alert">
            <Icon name="alert" size="sm" aria-hidden="true" />
            <span>{stepError}</span>
          </div>
        )}

        {/* ── Step 1: Personal Info ── */}
        {currentStep === 'personal' && (
          <section aria-labelledby="step-heading">
            <h2
              id="step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className={styles.stepHeading}
            >
              Step 1 of 3: Personal Information
            </h2>
            <p className={styles.stepDescription}>
              Please provide your legal name and address as they appear on your government-issued ID.
            </p>
            <div className={styles.formGrid}>
              <Input
                label="First Name"
                value={personalInfo.firstName}
                onChange={(v) => setPersonalInfo((p) => ({ ...p, firstName: v }))}
                placeholder="e.g. Jane"
                required
                error={personalErrors.firstName}
              />
              <Input
                label="Last Name"
                value={personalInfo.lastName}
                onChange={(v) => setPersonalInfo((p) => ({ ...p, lastName: v }))}
                placeholder="e.g. Smith"
                required
                error={personalErrors.lastName}
              />
              <div className={styles.fullWidth}>
                <Input
                  label="Date of Birth"
                  value={personalInfo.dateOfBirth}
                  onChange={(v) => setPersonalInfo((p) => ({ ...p, dateOfBirth: v }))}
                  placeholder="YYYY-MM-DD"
                  type="text"
                  required
                  error={personalErrors.dateOfBirth}
                />
              </div>
              <div className={styles.fullWidth}>
                <Input
                  label="Street Address"
                  value={personalInfo.address}
                  onChange={(v) => setPersonalInfo((p) => ({ ...p, address: v }))}
                  placeholder="e.g. 123 Main Street"
                  required
                  error={personalErrors.address}
                />
              </div>
              <Input
                label="City"
                value={personalInfo.city}
                onChange={(v) => setPersonalInfo((p) => ({ ...p, city: v }))}
                placeholder="e.g. London"
                required
                error={personalErrors.city}
              />
              <Input
                label="Postal Code"
                value={personalInfo.postalCode}
                onChange={(v) => setPersonalInfo((p) => ({ ...p, postalCode: v }))}
                placeholder="e.g. SW1A 1AA"
                required
                error={personalErrors.postalCode}
              />
            </div>
          </section>
        )}

        {/* ── Step 2: Document Upload ── */}
        {currentStep === 'document' && (
          <section aria-labelledby="step-heading">
            <h2
              id="step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className={styles.stepHeading}
            >
              Step 2 of 3: Document Upload
            </h2>
            <p className={styles.stepDescription}>
              Upload a clear photo or scan of your government-issued ID (passport, driving licence, or national ID card). Accepted formats: PDF, JPG, PNG. Maximum size: 10 MB.
            </p>
            <FileUpload
              accept={['application/pdf', 'image/jpeg', 'image/png']}
              maxSizeMb={10}
              multiple={false}
              onFiles={handleFiles}
              error={fileError}
              disabled={isSubmitting}
            />
            {/* Uploaded file list with live announcement */}
            {uploadedFiles.length > 0 && (
              <div
                className={styles.fileList}
                aria-live="polite"
                aria-label="Selected files"
              >
                <p className={styles.fileListLabel}>Selected file:</p>
                <ul className={styles.fileListItems}>
                  {uploadedFiles.map((file) => (
                    <li key={file.name} className={styles.fileListItem}>
                      <Icon name="check" size="sm" aria-hidden="true" />
                      <span>{file.name}</span>
                      <span className={styles.fileSize}>
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {uploadedFiles.length === 0 && !fileError && (
              <p className={styles.emptyHint} aria-live="polite">
                No document selected yet. Please upload a file to continue.
              </p>
            )}
          </section>
        )}

        {/* ── Step 3: Selfie ── */}
        {currentStep === 'selfie' && (
          <section aria-labelledby="step-heading">
            <h2
              id="step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className={styles.stepHeading}
            >
              Step 3 of 3: Selfie Capture
            </h2>
            <p className={styles.stepDescription}>
              Take a clear selfie so we can match your face to your ID document. Ensure you are in a well-lit area and your face is fully visible.
            </p>

            {selfieError && (
              <div className={styles.selfieError} role="alert">
                <Icon name="alert" size="sm" aria-hidden="true" />
                <span>{selfieError}</span>
              </div>
            )}

            {selfieLoading && (
              <div className={styles.selfieLoading}>
                <Spinner size="md" label="Initialising camera" />
                <p className={styles.selfieLoadingText}>Initialising camera…</p>
              </div>
            )}

            {!selfieDataUrl && !selfieLoading && !selfieError && !streamRef.current && (
              <div className={styles.selfiePrompt}>
                <Button
                  variant="secondary"
                  onClick={startCamera}
                  aria-label="Start camera to capture selfie"
                >
                  Start Camera
                </Button>
              </div>
            )}

            {!selfieDataUrl && streamRef.current && !selfieLoading && (
              <div className={styles.cameraWrapper}>
                <video
                  ref={videoRef}
                  className={styles.cameraPreview}
                  aria-label="Live camera preview for selfie capture"
                  playsInline
                  muted
                />
                <Button
                  variant="primary"
                  onClick={captureSelfie}
                  aria-label="Capture selfie photo"
                >
                  Capture Photo
                </Button>
              </div>
            )}

            {selfieDataUrl && (
              <div className={styles.selfiePreview}>
                <img
                  src={selfieDataUrl}
                  alt="Your captured selfie for identity verification"
                  className={styles.selfieImage}
                />
                <Button
                  variant="ghost"
                  onClick={retakeSelfie}
                  aria-label="Retake selfie photo"
                >
                  Retake Photo
                </Button>
              </div>
            )}

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />
          </section>
        )}
      </Card>

      {/* Navigation Buttons */}
      <div className={styles.navButtons}>
        <Button
          variant="secondary"
          disabled={isFirstStep || isSubmitting}
          onClick={handleBack}
          aria-label={
            isFirstStep
              ? 'Back (unavailable on first step)'
              : `Back to ${STEPS[currentStepIndex - 1].label}`
          }
        >
          Back
        </Button>

        <div className={styles.navRight}>
          <Button
            variant="ghost"
            onClick={() => setShowDiscardModal(true)}
            disabled={isSubmitting}
            aria-label="Save and exit verification"
          >
            Save &amp; Exit
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            disabled={isNextDisabled}
            onClick={handleNext}
            aria-label={isSubmitting ? 'Submitting, please wait' : nextButtonLabel}
          >
            {nextButtonLabel}
          </Button>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      <Modal
        open={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        title="Discard verification progress?"
      >
        <div className={styles.modalContent}>
          <p>
            If you exit now, your progress will be saved and you can continue later. Are you sure you want to exit?
          </p>
          <div className={styles.modalButtons}>
            <Button
              variant="secondary"
              onClick={() => setShowDiscardModal(false)}
            >
              Continue Verification
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscardConfirm}
            >
              Exit Anyway
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default KYCVerificationWizard;
