import React from 'react';
import { TestHeader } from './TestHeader';
import { QuestionArea } from './QuestionArea';
import { QuestionSidebar } from './QuestionSidebar';

export const OnlineTestLayout = () => {
  return (
    <div className="bg-[#F7F7F4] min-h-screen">
      <TestHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <QuestionArea />
          </div>
          <div className="w-full lg:w-[320px] shrink-0">
            <div className="sticky top-8">
              <QuestionSidebar />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
