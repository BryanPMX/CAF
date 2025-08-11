// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/CaseProgressTracker.tsx (New File)
'use client';

import React from 'react';
import { Steps } from 'antd';

const { Step } = Steps;

interface CaseProgressTrackerProps {
  allStages: string[];
  currentStage: string;
  stageLabels: { [key: string]: string }; // For translation
}

const CaseProgressTracker: React.FC<CaseProgressTrackerProps> = ({ allStages, currentStage, stageLabels }) => {
  // Find the index of the current stage in the ordered list.
  const currentStageIndex = allStages.indexOf(currentStage);

  return (
    <div className="mt-4">
      <Steps current={currentStageIndex} size="small">
        {allStages.map((stage, index) => {
          // Determine the status of each step based on the current stage's index.
          let status: 'finish' | 'process' | 'wait' = 'wait';
          if (index < currentStageIndex) {
            status = 'finish';
          } else if (index === currentStageIndex) {
            status = 'process';
          }
          
          return <Step key={stage} title={stageLabels[stage] || stage} status={status} />;
        })}
      </Steps>
    </div>
  );
};

export default CaseProgressTracker;