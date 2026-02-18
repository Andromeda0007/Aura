'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Brain, Sparkles, Zap, MessageSquare, BarChart3, Shield, Layers } from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: Layers,
      title: 'Context-Aware AI',
      description: 'Understands what you draw and say together, not separately',
    },
    {
      icon: Zap,
      title: 'Real-Time Assistance',
      description: 'Generate quizzes, summaries, and explanations instantly',
    },
    {
      icon: MessageSquare,
      title: 'Voice Commands',
      description: 'Just say "Hey Aura" - no keyboard needed during teaching',
    },
    {
      icon: BarChart3,
      title: 'Student Analytics',
      description: 'Track engagement and understanding in real-time',
    },
    {
      icon: Shield,
      title: 'Privacy First',
      description: 'Your lectures stay private, secure, and under your control',
    },
    {
      icon: Sparkles,
      title: 'Smart Summaries',
      description: 'Automatic session summaries with key points and visuals',
    },
  ]

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-dark-800/30">
        <div className="container-custom flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-dark-800 rounded-lg flex items-center justify-center border-2 border-primary-500/50">
              <Brain className="w-5 h-5 text-primary-500" />
            </div>
            <span className="text-xl font-bold text-dark-50">Aura</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="btn-ghost btn-md">
              Sign In
            </Link>
            <Link href="/auth/signup" className="btn-primary btn-md">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="pt-32 pb-20 px-4">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-dark-800 border border-dark-800/50">
                <Brain className="w-4 h-4 text-primary-500" />
                <span className="text-sm font-medium text-dark-50">AI-Powered Teaching Assistant</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-dark-50 mb-6 leading-tight">
                Transform Your
                <span className="text-gradient"> Smartboard </span>
                Lectures
              </h1>
              
              <p className="text-xl md:text-2xl text-dark-200 mb-10 max-w-3xl mx-auto leading-relaxed">
                Aura fuses what you draw with what you say, creating intelligent context that helps you teach better. Generate quizzes, answer questions, and engage students in real-time.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth/signup" className="btn-primary btn-xl w-full sm:w-auto">
                  Start Teaching with Aura
                </Link>
                <Link href="#features" className="btn-outline btn-xl w-full sm:w-auto">
                  Learn More
                </Link>
              </div>

              <div className="mt-12 flex items-center justify-center gap-8 text-sm text-dark-300">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                  <span>Real-time processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Privacy focused</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Voice controlled</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="py-20 px-4 bg-dark-900/50">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-dark-50 mb-4">
                Powerful Features for Modern Teaching
              </h2>
              <p className="text-xl text-dark-200 max-w-2xl mx-auto">
                Everything you need to create engaging, interactive lessons with AI assistance
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="card p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 group"
                >
                  <div className="w-12 h-12 bg-dark-800 rounded-lg flex items-center justify-center mb-4 border-2 border-primary-500/50">
                    <feature.icon className="w-6 h-6 text-primary-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-dark-50 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-dark-200 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="max-w-4xl mx-auto text-center"
            >
              <div className="card p-12 bg-dark-800 shadow-strong hover:shadow-xl transition-all">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-dark-50">
                  Ready to Transform Your <span className="text-primary-500">Teaching</span>?
                </h2>
                <p className="text-xl mb-8 text-dark-200">
                  Join educators who are creating more engaging, effective lessons with AI assistance
                </p>
                <Link href="/auth/signup" className="btn-primary btn-xl shadow-lg">
                  Get Started Free
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-dark-800/30 py-12 px-4 bg-dark-900/50">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-dark-800 rounded-lg flex items-center justify-center border border-primary-500/50">
                <Brain className="w-4 h-4 text-primary-500" />
              </div>
              <span className="font-bold text-dark-50">Aura</span>
            </div>
            
            <p className="text-dark-300 text-sm">
              Built for educators, powered by AI
            </p>
            
            <div className="flex items-center gap-6 text-sm text-dark-300">
              <Link href="/privacy" className="transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
