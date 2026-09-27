import React from 'react';
import { ProgressHeader } from './ProgressHeader';
import { TimelineSection } from './TimelineSection';
import { InterviewSchedule } from './InterviewSchedule';
import { CandidateProfileSidebar } from './CandidateProfileSidebar';

export const ProgressLayout = () => {
  return (
    <div className="bg-[#F7F7F4] min-h-screen pt-20 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProgressHeader />
        
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <TimelineSection />
            <InterviewSchedule />
          </div>
          <div className="w-full lg:w-[320px] shrink-0">
            <div className="sticky top-24">
              <CandidateProfileSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
