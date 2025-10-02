import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Service, CreateServiceRequest, UpdateServiceRequest } from '../types/service';

const COLLECTION_NAME = 'services';

export class ServiceService {
  private collection = collection(db, COLLECTION_NAME);

  async getAllServices(): Promise<Service[]> {
    try {
      const q = query(
        this.collection, 
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      const services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Service[];
      
      // Trier côté client pour éviter l'index composite
      return services.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      
      throw error;
    }
  }

  async getServiceById(id: string): Promise<Service | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as Service;
      }
      return null;
    } catch (error) {
      
      throw error;
    }
  }

  async createService(serviceData: CreateServiceRequest): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(this.collection, {
        ...serviceData,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });
      return docRef.id;
    } catch (error) {
      
      throw error;
    }
  }

  async updateService(updateData: UpdateServiceRequest): Promise<void> {
    try {
      const { id, ...data } = updateData;
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      
      throw error;
    }
  }

  async deleteService(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      // Soft delete - mark as inactive instead of actual deletion
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: new Date()
      });
    } catch (error) {
      
      throw error;
    }
  }

  async getServicesStats(): Promise<{
    total: number;
    withManager: number;
    totalBudget: number;
  }> {
    try {
      const services = await this.getAllServices();
      return {
        total: services.length,
        withManager: services.filter(s => s.manager).length,
        totalBudget: services.reduce((sum, s) => sum + (s.budget || 0), 0)
      };
    } catch (error) {
      
      throw error;
    }
  }
}

export const serviceService = new ServiceService();