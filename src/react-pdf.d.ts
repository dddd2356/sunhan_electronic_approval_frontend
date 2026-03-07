declare module 'react-pdf' {
    import { ComponentType, ReactNode } from 'react';

    export const pdfjs: {
        GlobalWorkerOptions: { workerSrc: string };
        version: string;
    };

    interface DocumentProps {
        file: string | null;
        onLoadSuccess?: (pdf: { numPages: number }) => void;
        onLoadError?: (error: Error) => void;
        loading?: ReactNode;
        children?: ReactNode;
    }

    interface PageProps {
        pageNumber: number;
        scale?: number;
        width?: number;
        renderTextLayer?: boolean;
        renderAnnotationLayer?: boolean;
        loading?: ReactNode;
    }

    export const Document: ComponentType<DocumentProps>;
    export const Page: ComponentType<PageProps>;
}